import { Order } from '@domain/order/entities/order.entity';
import { Transaction } from '@domain/order/entities/transaction.entity';
import { Body, Controller, HttpCode, HttpStatus, Post, NotFoundException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookEventType, WebhookPayloadDto } from './dto/webhook-payload.dto';
import { TestWebhookDto } from './dto/test-webhook.dto';
import { WebhookService } from './webhook.service';
import { Public } from '@src/infra/decorator/public.decorator';

@Public()
@ApiTags('webhooks')
@Controller('webhooks/test')
export class WebhookTestController {
  constructor(
    private readonly webhookService: WebhookService,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Simulate webhook event',
    description:
      'Simulates a webhook event by fetching order from database and building the webhook payload. Useful for testing webhook processing.',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook simulated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  async simulateWebhook(@Body() testDto: TestWebhookDto): Promise<{ success: boolean; payload: WebhookPayloadDto }> {
    // Buscar a transaction com a relação do order
    const transaction = await this.transactionRepository.findOne({
      where: { transactionId: testDto.transactionId, deletedAt: null },
      relations: ['order'],
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${testDto.transactionId} not found`);
    }

    // Buscar o order completo com todas as relações necessárias
    const order = await this.orderRepository.findOne({
      where: { id: transaction.order.id, deletedAt: null },
      relations: ['customer', 'cart', 'subscriptionPeriods', 'subscriptionPeriods.subscription'],
    });

    if (!order) {
      throw new NotFoundException(`Order ${transaction.order.id} not found`);
    }

    // Buscar subscription se o order tiver subscriptionPeriods
    let subscriptionId: string | undefined;
    if (order.subscriptionPeriods && order.subscriptionPeriods.length > 0) {
      const period = order.subscriptionPeriods[0];
      if (period.subscription?.id) {
        subscriptionId = period.subscription.id;
      }
    }

    // Montar o payload do webhook
    const payload: WebhookPayloadDto = {
      event: testDto.event,
      transactionId: transaction.transactionId,
      orderId: order.id,
      customerId: order.customer.id,
      amount: parseFloat(transaction.amount.toString()),
      currency: transaction.currency || 'BRL',
      paymentMethod: order.paymentMethod.toString(),
      timestamp: new Date().toISOString(),
      metadata: {
        cartId: order.cart?.id,
        ...(subscriptionId && { subscriptionId }),
      },
    };

    // Processar o webhook
    await this.webhookService.processWebhook(payload);

    return {
      success: true,
      payload,
    };
  }
}
