import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@domain/order/entities/order.entity';
import { Transaction, TransactionStatus } from '@domain/order/entities/transaction.entity';
import { OrderService } from '@domain/order/services/order.service';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';
import { WebhookEventType, WebhookPayloadDto } from './dto/webhook-payload.dto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly MAX_EVENT_AGE_HOURS = 24; // Máximo de 24 horas para processar um evento antigo

  constructor(private readonly orderService: OrderService) {}

  @Transactional()
  async processWebhook(payload: WebhookPayloadDto): Promise<void> {
    this.logger.log(`Processing webhook event: ${payload.event} for transaction: ${payload.transactionId}`);

    try {
      // Passo 1: Buscar a transaction
      const transaction = await this.orderService.findTransactionByTransactionId(payload.transactionId);

      if (!transaction) {
        throw new NotFoundException(`Transaction ${payload.transactionId} not found`);
      }

      // Passo 2: Buscar o order (se não existir, lança 404)
      const order = await this.orderService.findOneOrFail(payload.orderId);

      // Passo 3: Validar que o order pertence à transaction
      if (transaction.order.id !== order.id) {
        throw new BadRequestException(
          `Transaction ${payload.transactionId} does not belong to order ${payload.orderId}`,
        );
      }

      // Passo 4: Validar consistência dos dados (após confirmar que order e transaction existem e estão relacionados)
      this.validatePayloadConsistency(payload, transaction);

      // Passo 5: Verificar idempotência e validar transição de status
      const expectedStatus = this.getExpectedTransactionStatus(payload.event);

      if (transaction.status === expectedStatus) {
        this.logger.warn(
          `Transaction ${payload.transactionId} already has status ${expectedStatus}. Webhook already processed. Skipping.`,
        );
        return;
      }

      // Proteger contra downgrade de status (não permitir mudanças para status pior)
      if (this.isStatusDowngrade(transaction.status, expectedStatus)) {
        this.logger.warn(
          `Attempted to downgrade transaction ${payload.transactionId} from ${transaction.status} to ${expectedStatus}. This is not allowed. Skipping.`,
        );
        return;
      }

      // Passo 6: Processar o evento baseado no tipo
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

  /**
   * Valida se os dados do payload são consistentes com a transaction existente
   * Nota: A validação de orderId e customerId já foi feita antes (order existe e pertence à transaction)
   */
  private validatePayloadConsistency(payload: WebhookPayloadDto, transaction: Transaction): void {
    // Validar amount com tolerância de 0.01 para diferenças de arredondamento
    const amountDifference = Math.abs(Number(payload.amount) - Number(transaction.amount));
    if (amountDifference > 0.01) {
      throw new BadRequestException(
        `Amount mismatch: payload has ${payload.amount} but transaction has ${transaction.amount}`,
      );
    }

    // Validar currency
    if (payload.currency !== transaction.currency) {
      throw new BadRequestException(
        `Currency mismatch: payload has ${payload.currency} but transaction has ${transaction.currency}`,
      );
    }

    // Validar que o customerId do payload corresponde ao customer do order
    if (payload.customerId !== transaction.order.customer.id) {
      throw new BadRequestException(
        `Customer ID mismatch: payload has ${payload.customerId} but order belongs to customer ${transaction.order.customer.id}`,
      );
    }
  }

  /**
   * Verifica se uma mudança de status representa um downgrade (mudança para um status pior)
   * Hierarquia de status: PAID > PROCESSING > CREATED > FAILED/REFUSED
   */
  private isStatusDowngrade(currentStatus: TransactionStatus, newStatus: TransactionStatus): boolean {
    // Se já está PAID, não pode voltar para outro status
    if (currentStatus === TransactionStatus.PAID) {
      return newStatus !== TransactionStatus.PAID;
    }

    // Se está em FAILED/REFUSED, transições para qualquer outro status são permitidas (podem ser upgrades)
    if (currentStatus === TransactionStatus.FAILED || currentStatus === TransactionStatus.REFUSED) {
      return false;
    }

    // Transições para FAILED/REFUSED são sempre permitidas (podem acontecer a qualquer momento)
    if (newStatus === TransactionStatus.FAILED || newStatus === TransactionStatus.REFUSED) {
      return false;
    }

    // Se está PROCESSING e tenta ir para CREATED, é downgrade
    if (currentStatus === TransactionStatus.PROCESSING && newStatus === TransactionStatus.CREATED) {
      return true;
    }

    // Se está PROCESSING e tenta ir para PAID, não é downgrade (é upgrade)
    if (currentStatus === TransactionStatus.PROCESSING && newStatus === TransactionStatus.PAID) {
      return false;
    }

    // Se está CREATED e tenta ir para PROCESSING ou PAID, não é downgrade (é upgrade)
    if (currentStatus === TransactionStatus.CREATED) {
      return false;
    }

    // Por padrão, não considerar como downgrade para permitir flexibilidade
    return false;
  }

  private async handlePaymentSuccess(order: any, transaction: Transaction, payload: WebhookPayloadDto): Promise<void> {
    // updateTransactionStatus já atualiza subscriptions automaticamente
    await this.orderService.updateTransactionStatus(transaction.transactionId, TransactionStatus.PAID);
    await this.orderService.updateStatus(order.id, OrderStatus.CONFIRMED);

    this.logger.log(
      `Payment success processed for order ${order.id} and transaction ${transaction.transactionId}. Subscriptions updated automatically.`,
    );
  }

  private async handlePaymentFailed(order: any, transaction: Transaction, payload: WebhookPayloadDto): Promise<void> {
    // updateTransactionStatus já atualiza subscriptions automaticamente
    await this.orderService.updateTransactionStatus(transaction.transactionId, TransactionStatus.FAILED);
    await this.orderService.updateStatus(order.id, OrderStatus.FAILED);

    this.logger.log(
      `Payment failed processed for order ${order.id} and transaction ${transaction.transactionId}. Subscriptions updated automatically.`,
    );
  }

  private async handlePaymentPending(order: any, transaction: Transaction, payload: WebhookPayloadDto): Promise<void> {
    // updateTransactionStatus já atualiza subscriptions automaticamente
    await this.orderService.updateTransactionStatus(transaction.transactionId, TransactionStatus.PROCESSING);

    // Só atualiza order para PENDING se ainda não estiver confirmado
    if (order.status !== OrderStatus.CONFIRMED) {
      await this.orderService.updateStatus(order.id, OrderStatus.PENDING);
    }

    this.logger.log(
      `Payment pending processed for order ${order.id} and transaction ${transaction.transactionId}. Subscriptions updated automatically.`,
    );
  }
}
