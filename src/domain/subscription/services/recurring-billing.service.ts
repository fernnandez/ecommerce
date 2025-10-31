import { OrderService } from '@domain/order/services/order.service';
import { PaymentMethod } from '@domain/order/entities/order.entity';
import {
  CHARGE_PROVIDER_TOKEN,
  ChargeRequest,
  ChargeStatus,
  IChargeProvider,
  PaymentMethod as IntegrationPaymentMethod,
} from '@integration/charge/interfaces/charge-provider.interface';
import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';
import { Subscription, SubscriptionStatus } from '../entities/subscription.entity';
import { SubscriptionService } from '../subscription.service';

export interface BillingResult {
  subscriptionId: string;
  success: boolean;
  orderId?: string;
  transactionId?: string;
  error?: string;
}

@Injectable()
export class RecurringBillingService {
  private readonly logger = new Logger(RecurringBillingService.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    @Inject(CHARGE_PROVIDER_TOKEN)
    private readonly chargeProvider: IChargeProvider,
  ) {}

  @Transactional()
  async processDueSubscriptions(): Promise<BillingResult[]> {
    const dueSubscriptions = await this.subscriptionService.findDueSubscriptions();
    this.logger.log(`Found ${dueSubscriptions.length} subscriptions due for billing`);

    const results: BillingResult[] = [];

    for (const subscription of dueSubscriptions) {
      try {
        const result = await this.processSubscriptionBilling(subscription);
        results.push(result);
      } catch (error) {
        this.logger.error(`Error processing billing for subscription ${subscription.id}: ${error.message}`);
        results.push({
          subscriptionId: subscription.id,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  @Transactional()
  async processSubscriptionBilling(subscription: Subscription): Promise<BillingResult> {
    this.logger.log(`Processing billing for subscription ${subscription.subscriptionId}`);

    const customer = subscription.customer;

    if (!customer) {
      throw new Error(`Customer not found for subscription ${subscription.id}`);
    }

    if (!customer.user) {
      this.logger.warn(`Customer ${customer.id} has no user associated. Using default values.`);
    }

    const chargeRequest: ChargeRequest = {
      amount: Number(subscription.price),
      currency: 'BRL',
      paymentMethod: IntegrationPaymentMethod.CARD, // Para recorrência, geralmente é card
      reference: subscription.subscriptionId,
      customerEmail: customer.user?.email,
      customerName: customer.user?.name,
    };

    const chargeResponse = await this.chargeProvider.charge(chargeRequest);

    // Usa OrderService para criar Order e Transaction
    const { order, transaction } = await this.orderService.createRecurringOrder(
      subscription.customer.id,
      Number(subscription.price),
      PaymentMethod.CARD,
      chargeResponse,
    );

    // Cria novo período na subscription
    await this.subscriptionService.createPeriod(subscription, transaction);

    // Atualiza status da subscription
    if (chargeResponse.status === ChargeStatus.PAID) {
      await this.subscriptionService.updateStatus(subscription.id, SubscriptionStatus.ACTIVE);
      // Atualiza próxima data de cobrança
      await this.subscriptionService.updateNextBillingDate(subscription.id);
    } else {
      // Se falhou, marca como PAST_DUE
      await this.subscriptionService.updateStatus(subscription.id, SubscriptionStatus.PAST_DUE);
    }

    return {
      subscriptionId: subscription.id,
      success: chargeResponse.status === ChargeStatus.PAID,
      orderId: order.id,
      transactionId: transaction.transactionId,
    };
  }
}
