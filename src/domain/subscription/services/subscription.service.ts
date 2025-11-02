import { Customer } from '@domain/customer/entities/customer.entity';
import { Order, OrderStatus } from '@domain/order/entities/order.entity';
import { TransactionStatus } from '@domain/order/entities/transaction.entity';
import { Product } from '@domain/product/entities/product.entity';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';
import { PeriodStatus, SubscriptionPeriod } from '../entities/subscription-period.entity';
import { Periodicity, Subscription, SubscriptionStatus } from '../entities/subscription.entity';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(SubscriptionPeriod)
    private readonly subscriptionPeriodRepository: Repository<SubscriptionPeriod>,
  ) {}

  @Transactional()
  async create(
    customer: Customer,
    product: Product,
    price: number,
    periodicity: Periodicity,
    originOrder: Order,
  ): Promise<Subscription> {
    const existingActiveSubscription = await this.subscriptionRepository.findOne({
      where: {
        customer: { id: customer.id },
        product: { id: product.id },
        status: SubscriptionStatus.ACTIVE,
        deletedAt: null,
      },
    });

    if (existingActiveSubscription) {
      throw new ConflictException(`Customer already has an active subscription for product ${product.id}`);
    }

    const startDate = new Date();

    const nextBillingDate = this.calculateNextBillingDate(periodicity);

    const subscriptionId = this.generateSubscriptionId();

    const initialStatus = this.mapOrderStatusToSubscriptionStatus(originOrder.status);

    const subscription = this.subscriptionRepository.create({
      subscriptionId,
      customer,
      product,
      price,
      periodicity,
      status: initialStatus,
      nextBillingDate,
      startDate,
      description: `Assinatura ${product.name || product.id}`,
    });

    const savedSubscription = await this.subscriptionRepository.save(subscription);

    const period = await this.createPeriod(savedSubscription, originOrder, price);

    savedSubscription.periods = [period];

    return savedSubscription;
  }

  @Transactional()
  async createPeriod(subscription: Subscription, order: Order, price: number): Promise<SubscriptionPeriod> {
    const today = new Date();
    const endDate = this.calculatePeriodEndDate(today, subscription.periodicity);

    const statusMapping: Record<OrderStatus, PeriodStatus> = {
      [OrderStatus.CONFIRMED]: PeriodStatus.PAID,
      [OrderStatus.PENDING]: PeriodStatus.PENDING,
      [OrderStatus.FAILED]: PeriodStatus.FAILED,
      [OrderStatus.CANCELLED]: PeriodStatus.FAILED,
    };

    const period = this.subscriptionPeriodRepository.create({
      subscription,
      order,
      startDate: today,
      endDate,
      price,
      billedAt: today,
      status: statusMapping[order.status],
    });

    return await this.subscriptionPeriodRepository.save(period);
  }

  async updateStatus(subscriptionId: string, status: SubscriptionStatus): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, deletedAt: null },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    subscription.status = status;
    return await this.subscriptionRepository.save(subscription);
  }

  async updateNextBillingDate(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, deletedAt: null },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    subscription.nextBillingDate = this.calculateNextBillingDate(subscription.periodicity);
    return await this.subscriptionRepository.save(subscription);
  }

  async updatePeriodStatus(subscriptionId: string, orderId: string, status: PeriodStatus): Promise<void> {
    const subscription = await this.findOneOrFail(subscriptionId);

    if (subscription.periods && subscription.periods.length > 0) {
      const period = subscription.periods.find(p => p.order?.id === orderId);
      if (period) {
        period.status = status;
        await this.subscriptionPeriodRepository.save(period);
      }
    }
  }

  async findAndUpdateSubscriptionByTransaction(
    transactionId: string,
    transactionStatus: TransactionStatus,
  ): Promise<{ subscriptionId: string; periodStatus: PeriodStatus; subscriptionStatus: SubscriptionStatus } | null> {
    const period = await this.subscriptionPeriodRepository
      .createQueryBuilder('period')
      .innerJoin('period.order', 'order')
      .innerJoin('order.transactions', 'transaction')
      .where('transaction.transactionId = :transactionId', { transactionId })
      .leftJoinAndSelect('period.subscription', 'subscription')
      .getOne();

    if (!period) {
      return null;
    }

    const periodStatusMapping: Record<TransactionStatus, PeriodStatus> = {
      [TransactionStatus.PAID]: PeriodStatus.PAID,
      [TransactionStatus.FAILED]: PeriodStatus.FAILED,
      [TransactionStatus.REFUSED]: PeriodStatus.FAILED,
      [TransactionStatus.CREATED]: PeriodStatus.PENDING,
      [TransactionStatus.PROCESSING]: PeriodStatus.PENDING,
    };

    const subscriptionStatusMapping: Record<TransactionStatus, SubscriptionStatus> = {
      [TransactionStatus.PAID]: SubscriptionStatus.ACTIVE,
      [TransactionStatus.FAILED]: SubscriptionStatus.PAST_DUE,
      [TransactionStatus.REFUSED]: SubscriptionStatus.PAST_DUE,
      [TransactionStatus.CREATED]: SubscriptionStatus.PENDING,
      [TransactionStatus.PROCESSING]: SubscriptionStatus.PENDING,
    };

    const periodStatus = periodStatusMapping[transactionStatus];
    const subscriptionStatus = subscriptionStatusMapping[transactionStatus];

    period.status = periodStatus;

    await this.subscriptionPeriodRepository.save(period);

    await this.updateStatus(period.subscription.id, subscriptionStatus);

    if (transactionStatus === TransactionStatus.PAID) {
      await this.updateNextBillingDate(period.subscription.id);
    }

    return {
      subscriptionId: period.subscription.id,
      periodStatus,
      subscriptionStatus,
    };
  }

  async findOneOrFail(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id, deletedAt: null },
      relations: ['customer', 'product', 'periods', 'periods.order'],
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  async findDueSubscriptions(): Promise<Subscription[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const subscriptions = await this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        deletedAt: null,
      },
      relations: ['customer', 'customer.user', 'product', 'periods'],
    });

    return subscriptions.filter(sub => {
      const nextBilling = new Date(sub.nextBillingDate);
      nextBilling.setHours(0, 0, 0, 0);
      return nextBilling <= today;
    });
  }

  async findByCustomer(customerId: string): Promise<Subscription[]> {
    return await this.subscriptionRepository.find({
      where: { customer: { id: customerId }, deletedAt: null },
      relations: ['customer', 'product', 'periods', 'periods.order'],
      order: { createdAt: 'DESC' },
    });
  }

  private calculateNextBillingDate(periodicity: Periodicity): Date {
    const date = new Date();

    switch (periodicity) {
      case Periodicity.MONTHLY:
        date.setMonth(date.getMonth() + 1);
        break;
      case Periodicity.QUARTERLY:
        date.setMonth(date.getMonth() + 3);
        break;
      case Periodicity.YEARLY:
        date.setFullYear(date.getFullYear() + 1);
        break;
    }

    return date;
  }

  private calculatePeriodEndDate(startDate: Date, periodicity: Periodicity): Date {
    const endDate = new Date(startDate);

    switch (periodicity) {
      case Periodicity.MONTHLY:
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0);
        break;
      case Periodicity.QUARTERLY:
        endDate.setMonth(endDate.getMonth() + 3);
        endDate.setDate(endDate.getDate() - 1);
        break;
      case Periodicity.YEARLY:
        endDate.setFullYear(endDate.getFullYear() + 1);
        endDate.setDate(endDate.getDate() - 1);
        break;
    }

    return endDate;
  }

  private generateSubscriptionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `sub_${timestamp}_${random}`.toUpperCase();
  }

  private mapOrderStatusToSubscriptionStatus(orderStatus: OrderStatus): SubscriptionStatus {
    const mapping: Record<OrderStatus, SubscriptionStatus> = {
      [OrderStatus.CONFIRMED]: SubscriptionStatus.ACTIVE,
      [OrderStatus.PENDING]: SubscriptionStatus.PENDING,
      [OrderStatus.FAILED]: SubscriptionStatus.CANCELED,
      [OrderStatus.CANCELLED]: SubscriptionStatus.CANCELED,
    };

    return mapping[orderStatus];
  }
}
