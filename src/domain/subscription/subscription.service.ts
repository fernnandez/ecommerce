import { Customer } from '@domain/customer/entities/customer.entity';
import { Transaction, TransactionStatus } from '@domain/order/entities/transaction.entity';
import { Product } from '@domain/product/entities/product.entity';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';
import { PeriodStatus, SubscriptionPeriod } from './entities/subscription-period.entity';
import { Periodicity, Subscription, SubscriptionStatus } from './entities/subscription.entity';

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
    initialTransaction: Transaction,
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

    // Calcula a próxima data de cobrança baseada na periodicidade
    const nextBillingDate = this.calculateNextBillingDate(periodicity);

    // Cria o subscriptionId único
    const subscriptionId = this.generateSubscriptionId();

    
    const initialStatus = this.mapTransactionStatusToSubscriptionStatus(initialTransaction.status);

    const subscription = this.subscriptionRepository.create({
      subscriptionId,
      customer,
      product,
      price,
      periodicity,
      status: initialStatus,
      nextBillingDate,
    });

    const savedSubscription = await this.subscriptionRepository.save(subscription);

    const period = await this.createPeriod(savedSubscription, initialTransaction);

    savedSubscription.periods = [period];

    return savedSubscription;
  }

  @Transactional()
  async createPeriod(subscription: Subscription, transaction: Transaction): Promise<SubscriptionPeriod> {
    const today = new Date();
    const endDate = this.calculatePeriodEndDate(today, subscription.periodicity);

    const statusMapping: Record<TransactionStatus, PeriodStatus> = {
      [TransactionStatus.PAID]: PeriodStatus.PAID,
      [TransactionStatus.FAILED]: PeriodStatus.FAILED,
      [TransactionStatus.REFUSED]: PeriodStatus.FAILED,
      [TransactionStatus.CREATED]: PeriodStatus.PENDING,
      [TransactionStatus.PROCESSING]: PeriodStatus.PENDING,
    };

    const period = this.subscriptionPeriodRepository.create({
      subscription,
      startDate: today,
      endDate,
      status: statusMapping[transaction.status],
      transaction,
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

  async findOneOrFail(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id, deletedAt: null },
      relations: ['customer', 'product', 'periods', 'periods.transaction'],
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
      relations: ['customer', 'product', 'periods'],
    });

    return subscriptions.filter(sub => {
      const nextBilling = new Date(sub.nextBillingDate);
      nextBilling.setHours(0, 0, 0, 0);
      return nextBilling <= today;
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

  private mapTransactionStatusToSubscriptionStatus(transactionStatus: TransactionStatus): SubscriptionStatus {
    const mapping: Record<TransactionStatus, SubscriptionStatus> = {
      [TransactionStatus.PAID]: SubscriptionStatus.ACTIVE,
      [TransactionStatus.CREATED]: SubscriptionStatus.PENDING,
      [TransactionStatus.PROCESSING]: SubscriptionStatus.PENDING,
      [TransactionStatus.FAILED]: SubscriptionStatus.CANCELED,
      [TransactionStatus.REFUSED]: SubscriptionStatus.CANCELED,
    };

    return mapping[transactionStatus];
  }
}
