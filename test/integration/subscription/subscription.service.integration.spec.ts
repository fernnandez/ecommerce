import { ConflictException, INestApplication, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from '@src/app.module';
import { Customer } from '@src/domain/customer/entities/customer.entity';
import { Order, OrderOrigin, OrderStatus, PaymentMethod } from '@src/domain/order/entities/order.entity';
import { Transaction, TransactionStatus } from '@src/domain/order/entities/transaction.entity';
import { PeriodStatus, SubscriptionPeriod } from '@src/domain/subscription/entities/subscription-period.entity';
import { Periodicity, Subscription, SubscriptionStatus } from '@src/domain/subscription/entities/subscription.entity';
import { SubscriptionService } from '@src/domain/subscription/services/subscription.service';
import { createTestingApp } from '@test/helper/create-testing-app';
import { runWithRollbackTransaction } from '@test/helper/database/test-transaction';
import { FixtureHelper } from '@test/helper/fixture-helper';
import { Repository } from 'typeorm';
import { StorageDriver, initializeTransactionalContext } from 'typeorm-transactional';

initializeTransactionalContext({ storageDriver: StorageDriver.AUTO });

describe('SubscriptionService - Integration', () => {
  let app: INestApplication;
  let service: SubscriptionService;
  let fixtures: FixtureHelper;
  let subscriptionRepo: Repository<Subscription>;
  let subscriptionPeriodRepo: Repository<SubscriptionPeriod>;
  let transactionRepo: Repository<Transaction>;
  let orderRepo: Repository<Order>;

  beforeAll(async () => {
    app = await createTestingApp({
      imports: [AppModule],
    });

    await app.init();

    fixtures = new FixtureHelper(app);
    service = app.get<SubscriptionService>(SubscriptionService);
    subscriptionRepo = app.get<Repository<Subscription>>(getRepositoryToken(Subscription));
    subscriptionPeriodRepo = app.get<Repository<SubscriptionPeriod>>(getRepositoryToken(SubscriptionPeriod));
    transactionRepo = app.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    orderRepo = app.get<Repository<Order>>(getRepositoryToken(Order));
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  // Helper function to create Order from Transaction status
  const createOrderFromTransaction = async (
    customer: Customer,
    transaction: Transaction,
    amount: number,
  ): Promise<Order> => {
    const orderStatusMap: Record<TransactionStatus, OrderStatus> = {
      [TransactionStatus.PAID]: OrderStatus.CONFIRMED,
      [TransactionStatus.FAILED]: OrderStatus.FAILED,
      [TransactionStatus.REFUSED]: OrderStatus.FAILED,
      [TransactionStatus.CREATED]: OrderStatus.PENDING,
      [TransactionStatus.PROCESSING]: OrderStatus.PENDING,
    };

    const order = orderRepo.create({
      customer,
      total: amount,
      status: orderStatusMap[transaction.status],
      paymentMethod: PaymentMethod.CARD,
      origin: OrderOrigin.CART,
    });

    const savedOrder = await orderRepo.save(order);

    // Link transaction to order
    transaction.order = savedOrder;
    await transactionRepo.save(transaction);

    // Reload order to ensure it's properly saved and available
    const reloadedOrder = await orderRepo.findOne({
      where: { id: savedOrder.id },
    });

    if (!reloadedOrder) {
      throw new Error(`Failed to reload order ${savedOrder.id} after creation`);
    }

    return reloadedOrder;
  };

  describe('create', () => {
    it(
      'should create a new subscription successfully',
      runWithRollbackTransaction(async () => {
        const customer = await fixtures.fixtures.customers.peter();
        const product = await fixtures.fixtures.products.monthlySubscription();
        const transaction = await fixtures.fixtures.transactions.paid(parseFloat(product.price.toString()));
        const order = await createOrderFromTransaction(customer, transaction, parseFloat(product.price.toString()));

        const result = await service.create(
          customer,
          product,
          parseFloat(product.price.toString()),
          Periodicity.MONTHLY,
          order,
        );

        expect(result).toBeDefined();
        expect(result.subscriptionId).toBeDefined();
        expect(result.customer.id).toBe(customer.id);
        expect(result.product.id).toBe(product.id);
        expect(result.price).toBe(parseFloat(product.price.toString()));
        expect(result.periodicity).toBe(Periodicity.MONTHLY);
        expect(result.status).toBe(SubscriptionStatus.ACTIVE);
        expect(result.nextBillingDate).toBeDefined();
        expect(result.periods).toHaveLength(1);
        expect(result.periods[0].status).toBe(PeriodStatus.PAID);

        // Verify database persistence
        const savedSubscription = await subscriptionRepo.findOne({
          where: { id: result.id },
          relations: ['customer', 'product', 'periods'],
        });
        expect(savedSubscription).toBeDefined();
        expect(savedSubscription?.subscriptionId).toBe(result.subscriptionId);
      }),
    );

    it(
      'should throw ConflictException when customer already has active subscription for the product',
      runWithRollbackTransaction(async () => {
        const customer = await fixtures.fixtures.customers.john();
        const product = await fixtures.fixtures.products.monthlySubscription();

        // John already has an active subscription for monthly plan in fixtures
        // Try to create another one with same product
        const transaction = await fixtures.fixtures.transactions.paid(parseFloat(product.price.toString()));
        const order = await createOrderFromTransaction(customer, transaction, parseFloat(product.price.toString()));

        await expect(
          service.create(customer, product, parseFloat(product.price.toString()), Periodicity.MONTHLY, order),
        ).rejects.toThrow(ConflictException);
      }),
    );

    it(
      'should calculate correct next billing date for MONTHLY periodicity',
      runWithRollbackTransaction(async () => {
        const customer = await fixtures.fixtures.customers.peter();
        const product = await fixtures.fixtures.products.monthlySubscription();
        const transaction = await fixtures.fixtures.transactions.paid(parseFloat(product.price.toString()));
        const order = await createOrderFromTransaction(customer, transaction, parseFloat(product.price.toString()));

        const result = await service.create(
          customer,
          product,
          parseFloat(product.price.toString()),
          Periodicity.MONTHLY,
          order,
        );

        const expectedDate = new Date();
        expectedDate.setMonth(expectedDate.getMonth() + 1);
        expect(result.nextBillingDate.getMonth()).toBe(expectedDate.getMonth());
        expect(result.nextBillingDate.getFullYear()).toBe(expectedDate.getFullYear());
      }),
    );

    it(
      'should calculate correct next billing date for QUARTERLY periodicity',
      runWithRollbackTransaction(async () => {
        const customer = await fixtures.fixtures.customers.mary();
        const product = await fixtures.fixtures.products.quarterlySubscription();
        const transaction = await fixtures.fixtures.transactions.paid(parseFloat(product.price.toString()));
        const order = await createOrderFromTransaction(customer, transaction, parseFloat(product.price.toString()));

        const result = await service.create(
          customer,
          product,
          parseFloat(product.price.toString()),
          Periodicity.QUARTERLY,
          order,
        );

        const expectedDate = new Date();
        expectedDate.setMonth(expectedDate.getMonth() + 3);
        expect(result.nextBillingDate.getMonth()).toBe(expectedDate.getMonth());
      }),
    );

    it(
      'should calculate correct next billing date for YEARLY periodicity',
      runWithRollbackTransaction(async () => {
        const customer = await fixtures.fixtures.customers.peter();
        const product = await fixtures.fixtures.products.yearlySubscription();
        const transaction = await fixtures.fixtures.transactions.paid(parseFloat(product.price.toString()));
        const order = await createOrderFromTransaction(customer, transaction, parseFloat(product.price.toString()));

        const result = await service.create(
          customer,
          product,
          parseFloat(product.price.toString()),
          Periodicity.YEARLY,
          order,
        );

        const expectedDate = new Date();
        expectedDate.setFullYear(expectedDate.getFullYear() + 1);
        expect(result.nextBillingDate.getFullYear()).toBe(expectedDate.getFullYear());
      }),
    );

    it(
      'should map transaction status PAID to subscription status ACTIVE',
      runWithRollbackTransaction(async () => {
        // Use a different customer/product combination to avoid conflict
        const customer = await fixtures.fixtures.customers.peter();
        const product = await fixtures.fixtures.products.quarterlySubscription();
        const transaction = await fixtures.fixtures.transactions.paid(parseFloat(product.price.toString()));
        const order = await createOrderFromTransaction(customer, transaction, parseFloat(product.price.toString()));

        const result = await service.create(
          customer,
          product,
          parseFloat(product.price.toString()),
          Periodicity.QUARTERLY,
          order,
        );

        expect(result.status).toBe(SubscriptionStatus.ACTIVE);
      }),
    );

    it(
      'should map transaction status PROCESSING to subscription status PENDING',
      runWithRollbackTransaction(async () => {
        const customer = await fixtures.fixtures.customers.mary();
        const product = await fixtures.fixtures.products.monthlySubscription();
        const transaction = await fixtures.fixtures.transactions.processing(parseFloat(product.price.toString()));
        const order = await createOrderFromTransaction(customer, transaction, parseFloat(product.price.toString()));

        const result = await service.create(
          customer,
          product,
          parseFloat(product.price.toString()),
          Periodicity.MONTHLY,
          order,
        );

        expect(result.status).toBe(SubscriptionStatus.PENDING);
      }),
    );

    it(
      'should map transaction status FAILED to subscription status CANCELED',
      runWithRollbackTransaction(async () => {
        const customer = await fixtures.fixtures.customers.peter();
        const product = await fixtures.fixtures.products.monthlySubscription();
        const transaction = await fixtures.fixtures.transactions.failed(parseFloat(product.price.toString()));
        const order = await createOrderFromTransaction(customer, transaction, parseFloat(product.price.toString()));

        const result = await service.create(
          customer,
          product,
          parseFloat(product.price.toString()),
          Periodicity.MONTHLY,
          order,
        );

        expect(result.status).toBe(SubscriptionStatus.CANCELED);
      }),
    );
  });

  describe('createPeriod', () => {
    it(
      'should create a period with correct dates for MONTHLY subscription',
      runWithRollbackTransaction(async () => {
        const subscription = await fixtures.fixtures.subscriptions.activeMonthlyJohn();
        const customer = subscription.customer;
        const transaction = await fixtures.fixtures.transactions.paid(parseFloat(subscription.price.toString()));
        const order = await createOrderFromTransaction(
          customer,
          transaction,
          parseFloat(subscription.price.toString()),
        );

        const result = await service.createPeriod(subscription, order, parseFloat(subscription.price.toString()));

        expect(result).toBeDefined();
        expect(result.subscription.id).toBe(subscription.id);
        expect(result.status).toBe(PeriodStatus.PAID);
        expect(result.startDate).toBeDefined();
        expect(result.endDate).toBeDefined();
        expect(result.order.id).toBe(order.id);
      }),
    );

    it(
      'should map transaction status to period status correctly',
      runWithRollbackTransaction(async () => {
        const subscription = await fixtures.fixtures.subscriptions.activeMonthlyJohn();
        const customer = subscription.customer;

        const testCases = [
          { orderStatus: OrderStatus.CONFIRMED, expectedPeriodStatus: PeriodStatus.PAID },
          { orderStatus: OrderStatus.FAILED, expectedPeriodStatus: PeriodStatus.FAILED },
          { orderStatus: OrderStatus.CANCELLED, expectedPeriodStatus: PeriodStatus.FAILED },
          { orderStatus: OrderStatus.PENDING, expectedPeriodStatus: PeriodStatus.PENDING },
        ];

        for (const testCase of testCases) {
          const order = orderRepo.create({
            customer,
            total: parseFloat(subscription.price.toString()),
            status: testCase.orderStatus,
            paymentMethod: PaymentMethod.CARD,
            origin: OrderOrigin.CART,
          });
          const savedOrder = await orderRepo.save(order);

          const result = await service.createPeriod(
            subscription,
            savedOrder,
            parseFloat(subscription.price.toString()),
          );

          expect(result.status).toBe(testCase.expectedPeriodStatus);
        }
      }),
    );

    it(
      'should calculate correct end date for QUARTERLY periodicity',
      runWithRollbackTransaction(async () => {
        const subscription = await fixtures.fixtures.subscriptions.pendingQuarterlyMary();
        const customer = subscription.customer;
        const transaction = await fixtures.fixtures.transactions.paid(parseFloat(subscription.price.toString()));
        const order = await createOrderFromTransaction(
          customer,
          transaction,
          parseFloat(subscription.price.toString()),
        );

        const result = await service.createPeriod(subscription, order, parseFloat(subscription.price.toString()));

        const expectedEndDate = new Date(result.startDate);
        expectedEndDate.setMonth(expectedEndDate.getMonth() + 3);
        expectedEndDate.setDate(expectedEndDate.getDate() - 1);

        expect(result.endDate.getMonth()).toBe(expectedEndDate.getMonth());
      }),
    );

    it(
      'should calculate correct end date for YEARLY periodicity',
      runWithRollbackTransaction(async () => {
        const subscription = await fixtures.fixtures.subscriptions.pastDueYearlyPeter();
        const customer = subscription.customer;
        const transaction = await fixtures.fixtures.transactions.paid(parseFloat(subscription.price.toString()));
        const order = await createOrderFromTransaction(
          customer,
          transaction,
          parseFloat(subscription.price.toString()),
        );

        const result = await service.createPeriod(subscription, order, parseFloat(subscription.price.toString()));

        const expectedEndDate = new Date(result.startDate);
        expectedEndDate.setFullYear(expectedEndDate.getFullYear() + 1);
        expectedEndDate.setDate(expectedEndDate.getDate() - 1);

        expect(result.endDate.getFullYear()).toBe(expectedEndDate.getFullYear());
      }),
    );
  });

  describe('updateStatus', () => {
    it(
      'should update subscription status successfully',
      runWithRollbackTransaction(async () => {
        const subscription = await fixtures.fixtures.subscriptions.pendingQuarterlyMary();

        const result = await service.updateStatus(subscription.id, SubscriptionStatus.ACTIVE);

        expect(result.status).toBe(SubscriptionStatus.ACTIVE);

        // Verify database update
        const updatedSubscription = await subscriptionRepo.findOne({
          where: { id: subscription.id },
        });
        expect(updatedSubscription?.status).toBe(SubscriptionStatus.ACTIVE);
      }),
    );

    it(
      'should throw NotFoundException when subscription does not exist',
      runWithRollbackTransaction(async () => {
        await expect(
          service.updateStatus('00000000-0000-0000-0000-000000000000', SubscriptionStatus.ACTIVE),
        ).rejects.toThrow(NotFoundException);
      }),
    );
  });

  describe('updateNextBillingDate', () => {
    it(
      'should update next billing date based on MONTHLY periodicity',
      runWithRollbackTransaction(async () => {
        const subscription = await fixtures.fixtures.subscriptions.activeMonthlyJohn();

        const result = await service.updateNextBillingDate(subscription.id);

        const expectedDate = new Date();
        expectedDate.setMonth(expectedDate.getMonth() + 1);
        expect(result.nextBillingDate.getMonth()).toBe(expectedDate.getMonth());
      }),
    );

    it(
      'should update next billing date based on QUARTERLY periodicity',
      runWithRollbackTransaction(async () => {
        const subscription = await fixtures.fixtures.subscriptions.pendingQuarterlyMary();

        const result = await service.updateNextBillingDate(subscription.id);

        const expectedDate = new Date();
        expectedDate.setMonth(expectedDate.getMonth() + 3);
        expect(result.nextBillingDate.getMonth()).toBe(expectedDate.getMonth());
      }),
    );

    it(
      'should throw NotFoundException when subscription does not exist',
      runWithRollbackTransaction(async () => {
        await expect(service.updateNextBillingDate('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
          NotFoundException,
        );
      }),
    );
  });

  describe('updatePeriodStatus', () => {
    it(
      'should update period status successfully',
      runWithRollbackTransaction(async () => {
        // Create a new subscription and period to have control over the order
        const customer = await fixtures.fixtures.customers.mary();
        const product = await fixtures.fixtures.products.monthlySubscription();
        const transaction = await fixtures.fixtures.transactions.paid(parseFloat(product.price.toString()));
        const order = await createOrderFromTransaction(customer, transaction, parseFloat(product.price.toString()));

        const subscription = await service.create(
          customer,
          product,
          parseFloat(product.price.toString()),
          Periodicity.MONTHLY,
          order,
        );

        // Reload with periods
        const fullSubscription = await subscriptionRepo.findOne({
          where: { id: subscription.id },
          relations: ['periods', 'periods.order'],
        });

        expect(fullSubscription?.periods).toBeDefined();
        expect(fullSubscription.periods.length).toBeGreaterThan(0);

        const period = fullSubscription.periods[0];
        expect(period.order).toBeDefined();

        // Update period status
        await service.updatePeriodStatus(subscription.id, period.order.id, PeriodStatus.FAILED);

        // Verify update
        const updatedPeriod = await subscriptionPeriodRepo.findOne({
          where: { id: period.id },
        });
        expect(updatedPeriod?.status).toBe(PeriodStatus.FAILED);
      }),
    );
  });

  describe('findOneOrFail', () => {
    it(
      'should return subscription when found',
      runWithRollbackTransaction(async () => {
        const subscription = await fixtures.fixtures.subscriptions.activeMonthlyJohn();

        const result = await service.findOneOrFail(subscription.id);

        expect(result).toBeDefined();
        expect(result.id).toBe(subscription.id);
        expect(result.customer).toBeDefined();
        expect(result.product).toBeDefined();
      }),
    );

    it(
      'should throw NotFoundException when subscription does not exist',
      runWithRollbackTransaction(async () => {
        await expect(service.findOneOrFail('00000000-0000-0000-0000-000000000000')).rejects.toThrow(NotFoundException);
      }),
    );
  });

  describe('findDueSubscriptions', () => {
    it(
      'should return subscriptions with nextBillingDate <= today',
      runWithRollbackTransaction(async () => {
        // Create a subscription with past due date
        const customer = await fixtures.fixtures.customers.peter();
        const product = await fixtures.fixtures.products.monthlySubscription();
        const transaction = await fixtures.fixtures.transactions.paid(parseFloat(product.price.toString()));
        const order = await createOrderFromTransaction(customer, transaction, parseFloat(product.price.toString()));

        const pastDateSubscription = await service.create(
          customer,
          product,
          parseFloat(product.price.toString()),
          Periodicity.MONTHLY,
          order,
        );

        // Manually set a past date
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);
        await subscriptionRepo.update(pastDateSubscription.id, { nextBillingDate: pastDate });

        const result = await service.findDueSubscriptions();

        expect(Array.isArray(result)).toBe(true);
        const foundSubscription = result.find(s => s.id === pastDateSubscription.id);
        expect(foundSubscription).toBeDefined();
      }),
    );

    it(
      'should only return ACTIVE subscriptions',
      runWithRollbackTransaction(async () => {
        const result = await service.findDueSubscriptions();

        result.forEach(subscription => {
          expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
        });
      }),
    );
  });

  describe('findAndUpdateSubscriptionByTransaction', () => {
    it(
      'should update subscription and period status based on transaction status PAID',
      runWithRollbackTransaction(async () => {
        // Create subscription and period with order
        const customer = await fixtures.fixtures.customers.mary();
        const product = await fixtures.fixtures.products.monthlySubscription();
        const transaction = await fixtures.fixtures.transactions.processing(parseFloat(product.price.toString()));
        const order = await createOrderFromTransaction(customer, transaction, parseFloat(product.price.toString()));

        const subscription = await service.create(
          customer,
          product,
          parseFloat(product.price.toString()),
          Periodicity.MONTHLY,
          order,
        );

        // Update transaction status to PAID
        await transactionRepo.update(transaction.id, { status: TransactionStatus.PAID });

        const updatedTransaction = await transactionRepo.findOne({
          where: { id: transaction.id },
        });

        const result = await service.findAndUpdateSubscriptionByTransaction(
          updatedTransaction.transactionId,
          TransactionStatus.PAID,
        );

        expect(result).toBeDefined();
        expect(result?.subscriptionId).toBe(subscription.id);
        expect(result?.periodStatus).toBe(PeriodStatus.PAID);
        expect(result?.subscriptionStatus).toBe(SubscriptionStatus.ACTIVE);

        // Verify subscription was updated
        const updatedSubscription = await subscriptionRepo.findOne({
          where: { id: subscription.id },
        });
        expect(updatedSubscription?.status).toBe(SubscriptionStatus.ACTIVE);
      }),
    );

    it(
      'should update subscription and period status based on transaction status FAILED',
      runWithRollbackTransaction(async () => {
        const customer = await fixtures.fixtures.customers.peter();
        const product = await fixtures.fixtures.products.monthlySubscription();
        const transaction = await fixtures.fixtures.transactions.processing(parseFloat(product.price.toString()));
        const order = await createOrderFromTransaction(customer, transaction, parseFloat(product.price.toString()));

        const subscription = await service.create(
          customer,
          product,
          parseFloat(product.price.toString()),
          Periodicity.MONTHLY,
          order,
        );

        const updatedTransaction = await transactionRepo.findOne({
          where: { id: transaction.id },
        });

        const result = await service.findAndUpdateSubscriptionByTransaction(
          updatedTransaction.transactionId,
          TransactionStatus.FAILED,
        );

        expect(result).toBeDefined();
        expect(result?.periodStatus).toBe(PeriodStatus.FAILED);
        expect(result?.subscriptionStatus).toBe(SubscriptionStatus.PAST_DUE);

        // Verify subscription was updated
        const updatedSubscription = await subscriptionRepo.findOne({
          where: { id: subscription.id },
        });
        expect(updatedSubscription?.status).toBe(SubscriptionStatus.PAST_DUE);
      }),
    );

    it(
      'should return null when period not found for transaction',
      runWithRollbackTransaction(async () => {
        const result = await service.findAndUpdateSubscriptionByTransaction('TXN-NON-EXISTENT', TransactionStatus.PAID);

        expect(result).toBeNull();
      }),
    );
  });
});
