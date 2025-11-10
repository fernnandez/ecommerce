import { Order, OrderStatus } from '@domain/order/entities/order.entity';
import { Transaction, TransactionStatus } from '@domain/order/entities/transaction.entity';
import { OrderService } from '@domain/order/services/order.service';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';
import { WebhookEventType, WebhookPayloadDto } from './dto/webhook-payload.dto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  private readonly statusTransitionValidator: Record<TransactionStatus, TransactionStatus[]> = {
    [TransactionStatus.PAID]: [TransactionStatus.PAID],
    [TransactionStatus.REFUSED]: [TransactionStatus.REFUSED],
    [TransactionStatus.PROCESSING]: [
      TransactionStatus.PAID,
      TransactionStatus.FAILED,
      TransactionStatus.REFUSED,
      TransactionStatus.PROCESSING,
    ],
    [TransactionStatus.CREATED]: [
      TransactionStatus.PROCESSING,
      TransactionStatus.PAID,
      TransactionStatus.FAILED,
      TransactionStatus.REFUSED,
      TransactionStatus.CREATED,
    ],
    [TransactionStatus.FAILED]: [
      TransactionStatus.PROCESSING,
      TransactionStatus.PAID,
      TransactionStatus.FAILED,
      TransactionStatus.REFUSED,
    ],
  };

  constructor(private readonly orderService: OrderService) {}

  @Transactional()
  async processWebhook(payload: WebhookPayloadDto): Promise<void> {
    this.logger.log(`Processing webhook event: ${payload.event} for transaction: ${payload.transactionId}`);

    try {
      const transaction = await this.orderService.findTransactionByTransactionId(payload.transactionId);

      if (!transaction) {
        throw new NotFoundException(`Transaction ${payload.transactionId} not found`);
      }

      const order = await this.orderService.findOneOrFail(payload.orderId);

      if (transaction.order.id !== order.id) {
        throw new BadRequestException(
          `Transaction ${payload.transactionId} does not belong to order ${payload.orderId}`,
        );
      }

      this.validatePayloadConsistency(payload, transaction);

      const expectedStatus = this.getExpectedTransactionStatus(payload.event);

      if (transaction.status === expectedStatus) {
        this.logger.warn(
          `Transaction ${payload.transactionId} already has status ${expectedStatus}. Webhook already processed. Skipping.`,
        );
        return;
      }

      if (this.isStatusDowngrade(transaction.status, expectedStatus)) {
        this.logger.warn(
          `Attempted to downgrade transaction ${payload.transactionId} from ${transaction.status} to ${expectedStatus}. This is not allowed. Skipping.`,
        );
        return;
      }

      await this.handlePaymentEvent(order, transaction, expectedStatus, payload.event);

      this.logger.log(`Webhook event ${payload.event} processed successfully for transaction ${payload.transactionId}`);
    } catch (error) {
      this.logger.error(
        `Error processing webhook event ${payload.event} for transaction ${payload.transactionId}: ${error.message}`,
        error.stack,
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

  private validatePayloadConsistency(payload: WebhookPayloadDto, transaction: Transaction): void {
    const amountDifference = Math.abs(Number(payload.amount) - Number(transaction.amount));
    if (amountDifference > 0.01) {
      throw new BadRequestException(
        `Amount mismatch: payload has ${payload.amount} but transaction has ${transaction.amount}`,
      );
    }

    if (payload.currency !== transaction.currency) {
      throw new BadRequestException(
        `Currency mismatch: payload has ${payload.currency} but transaction has ${transaction.currency}`,
      );
    }

    if (payload.customerId !== transaction.order.customer.id) {
      throw new BadRequestException(
        `Customer ID mismatch: payload has ${payload.customerId} but order belongs to customer ${transaction.order.customer.id}`,
      );
    }
  }

  private isStatusDowngrade(currentStatus: TransactionStatus, newStatus: TransactionStatus): boolean {
    const allowedStatuses = this.statusTransitionValidator[currentStatus];
    return !allowedStatuses.includes(newStatus);
  }

  private getOrderStatusForEvent(event: WebhookEventType): OrderStatus | null {
    const mapping: Record<WebhookEventType, OrderStatus | null> = {
      [WebhookEventType.PAYMENT_SUCCESS]: OrderStatus.CONFIRMED,
      [WebhookEventType.PAYMENT_FAILED]: OrderStatus.FAILED,
      [WebhookEventType.PAYMENT_PENDING]: OrderStatus.PENDING,
    };
    return mapping[event];
  }

  private async handlePaymentEvent(
    order: Order,
    transaction: Transaction,
    transactionStatus: TransactionStatus,
    event: WebhookEventType,
  ): Promise<void> {
    await this.orderService.updateTransactionStatus(transaction.transactionId, transactionStatus);

    const orderStatus = this.getOrderStatusForEvent(event);

    await this.orderService.updateStatus(order.id, orderStatus);

    this.logger.log(
      `Payment ${event} processed for order ${order.id} and transaction ${transaction.transactionId}. Subscriptions updated automatically.`,
    );
  }
}
