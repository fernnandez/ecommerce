import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import { WebhookService } from './webhook.service';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@infra/decorator/public.decorator';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('payment')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Payment webhook',
    description: 'Receives payment webhook events from payment gateway. Handles payment_success, payment_failed, and payment_pending events.',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid webhook payload',
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction or Order not found',
  })
  async handlePaymentWebhook(@Body() payload: WebhookPayloadDto): Promise<{ success: boolean }> {
    await this.webhookService.processWebhook(payload);
    return { success: true };
  }
}

