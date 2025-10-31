import { OrderStatus } from '@domain/order/entities/order.entity';
import { Transaction, TransactionStatus } from '@domain/order/entities/transaction.entity';
import { OrderService } from '@domain/order/services/order.service';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';
import { WebhookEventType, WebhookPayloadDto } from './dto/webhook-payload.dto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly orderService: OrderService) {}

  @Transactional()
  async processWebhook(payload: WebhookPayloadDto): Promise<void> {
    this.logger.log(`Processing webhook event: ${payload.event} for transaction: ${payload.transactionId}`);

    try {
      const transaction = await this.orderService.findTransactionByTransactionId(payload.transactionId);

      if (!transaction) {
        throw new NotFoundException(`Transaction ${payload.transactionId} not found`);
      }

      const expectedStatus = this.getExpectedTransactionStatus(payload.event);
      if (transaction.status === expectedStatus) {
        this.logger.warn(
          `Transaction ${payload.transactionId} already has status ${expectedStatus}. Webhook already processed. Skipping.`,
        );
        return;
      }

      const order = await this.orderService.findOneOrFail(payload.orderId);

      switch (payload.event) {
        case WebhookEventType.PAYMENT_SUCCESS:
          await this.handlePaymentSuccess(order, transaction, payload);
          break;
        case WebhookEventType.PAYMENT_FAILED:
          await this.handlePaymentFailed(order, transaction, payload);
          break;
        case WebhookEventType.PAYMENT_PENDING:
          await this.handlePaymentPending(order, transaction, payload);
          break;
        default:
          this.logger.warn(`Unknown webhook event type: ${payload.event}`);
      }

      this.logger.log(`Webhook event ${payload.event} processed successfully for transaction ${payload.transactionId}`);
    } catch (error) {
      this.logger.error(
        `Error processing webhook event ${payload.event} for transaction ${payload.transactionId}: ${error.message}`,
      );
      throw error;
    }
  }

  private getExpectedTransactionStatus(event: WebhookEventType): TransactionStatus {
    const mapping: Record<WebhookEventType, TransactionStatus> = {
      [WebhookEventType.PAYMENT_SUCCESS]: TransactionStatus.PAID,
      [WebhookEventType.PAYMENT_FAILED]: TransactionStatus.FAILED,
      [WebhookEventType.PAYMENT_PENDING]: TransactionStatus.PROCESSING,
    };
    return mapping[event];
  }

  private async handlePaymentSuccess(order: any, transaction: Transaction, payload: WebhookPayloadDto): Promise<void> {
    await this.orderService.updateStatus(order.id, OrderStatus.CONFIRMED);

    await this.orderService.updateTransactionStatus(transaction.transactionId, TransactionStatus.PAID);

    this.logger.log(`Payment success processed for order ${order.id}`);
  }

  private async handlePaymentFailed(order: any, transaction: Transaction, payload: WebhookPayloadDto): Promise<void> {
    await this.orderService.updateStatus(order.id, OrderStatus.FAILED);

    await this.orderService.updateTransactionStatus(transaction.transactionId, TransactionStatus.FAILED);

    this.logger.log(`Payment failed processed for order ${order.id}`);
  }

  private async handlePaymentPending(order: any, transaction: Transaction, payload: WebhookPayloadDto): Promise<void> {
    await this.orderService.updateStatus(order.id, OrderStatus.PENDING);

    await this.orderService.updateTransactionStatus(transaction.transactionId, TransactionStatus.PROCESSING);

    this.logger.log(`Payment pending processed for order ${order.id}`);
  }
}
