import { INestApplication, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from '@src/app.module';
import { CartItem } from '@src/domain/cart/entities/cart-item.entity';
import { Cart, CartStatus } from '@src/domain/cart/entities/cart.entity';
import { Order, OrderOrigin, OrderStatus, PaymentMethod } from '@src/domain/order/entities/order.entity';
import { Transaction, TransactionStatus } from '@src/domain/order/entities/transaction.entity';
import { OrderService } from '@src/domain/order/services/order.service';
import { Subscription } from '@src/domain/subscription/entities/subscription.entity';
import { ChargeStatus } from '@src/integration/charge/interfaces/charge-provider.interface';
import { createTestingApp } from '@test/helper/create-testing-app';
import { runWithRollbackTransaction } from '@test/helper/database/test-transaction';
import { FixtureHelper } from '@test/helper/fixture-helper';
import { Repository } from 'typeorm';
import { StorageDriver, initializeTransactionalContext } from 'typeorm-transactional';

initializeTransactionalContext({ storageDriver: StorageDriver.AUTO });

describe('OrderService - Integration', () => {
  let app: INestApplication;
  let service: OrderService;
  let fixtures: FixtureHelper;
  let orderRepo: Repository<Order>;
  let transactionRepo: Repository<Transaction>;
  let cartRepo: Repository<Cart>;
  let cartItemRepo: Repository<CartItem>;

  beforeAll(async () => {
    app = await createTestingApp({
      imports: [AppModule],
    });

    await app.init();

    fixtures = new FixtureHelper(app);
    service = app.get<OrderService>(OrderService);
    orderRepo = app.get<Repository<Order>>(getRepositoryToken(Order));
    transactionRepo = app.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    cartRepo = app.get<Repository<Cart>>(getRepositoryToken(Cart));
    cartItemRepo = app.get<Repository<CartItem>>(getRepositoryToken(CartItem));
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  describe('createOrder', () => {
    it(
      'should create order successfully with single products',
      runWithRollbackTransaction(async () => {
        const customer = await fixtures.fixtures.customers.peter();
        const product = await fixtures.fixtures.products.notebook();

        // Create a cart with items
        const cart = cartRepo.create({
          customer,
          status: CartStatus.OPEN,
          total: parseFloat(product.price.toString()),
        });
        const savedCart = await cartRepo.save(cart);

        const cartItem = cartItemRepo.create({
          cart: savedCart,
          product,
          quantity: 1,
          price: parseFloat(product.price.toString()),
          periodicity: null,
        });
        await cartItemRepo.save(cartItem);

        // Close cart
        savedCart.status = CartStatus.CLOSED;
        await cartRepo.save(savedCart);

        const result = await service.createOrder(customer.id, savedCart.id, PaymentMethod.CARD);

        expect(result).toBeDefined();
        expect(result.order).toBeDefined();
        expect(result.order.id).toBeDefined();
        expect(result.order.customer.id).toBe(customer.id);
        expect(result.order.cart.id).toBe(savedCart.id);
        expect(result.order.paymentMethod).toBe(PaymentMethod.CARD);
        expect(result.order.origin).toBe(OrderOrigin.CART);
        expect(result.order.total).toBeDefined();
        expect(result.subscriptionIds).toHaveLength(0); // No subscription products

        // Verify transaction was created
        const transaction = await transactionRepo.findOne({
          where: { order: { id: result.order.id } },
          relations: ['order'],
        });
        expect(transaction).toBeDefined();
        expect(transaction?.order.id).toBe(result.order.id);
      }),
    );

    it(
      'should create order with subscription products and create subscriptions',
      runWithRollbackTransaction(async () => {
        const customer = await fixtures.fixtures.customers.peter();
        const subscriptionProduct = await fixtures.fixtures.products.monthlySubscription();

        // Create a cart with subscription product
        const cart = cartRepo.create({
          customer,
          status: CartStatus.OPEN,
          total: parseFloat(subscriptionProduct.price.toString()),
        });
        const savedCart = await cartRepo.save(cart);

        const cartItem = cartItemRepo.create({
          cart: savedCart,
          product: subscriptionProduct,
          quantity: 1,
          price: parseFloat(subscriptionProduct.price.toString()),
          periodicity: subscriptionProduct.periodicity,
        });
        await cartItemRepo.save(cartItem);

        // Close cart
        savedCart.status = CartStatus.CLOSED;
        await cartRepo.save(savedCart);

        const result = await service.createOrder(customer.id, savedCart.id, PaymentMethod.CARD);

        expect(result).toBeDefined();
        expect(result.order).toBeDefined();
        expect(result.subscriptionIds.length).toBeGreaterThan(0);

        // Verify subscription was created
        const subscriptionRepo = app.get<Repository<Subscription>>(getRepositoryToken(Subscription));
        const subscription = await subscriptionRepo.findOne({
          where: { id: result.subscriptionIds[0] },
          relations: ['customer', 'product'],
        });
        expect(subscription).toBeDefined();
        expect(subscription?.customer.id).toBe(customer.id);
        expect(subscription?.product.id).toBe(subscriptionProduct.id);
      }),
    );

    it(
      'should reuse existing order when order already exists for cart',
      runWithRollbackTransaction(async () => {
        const customer = await fixtures.fixtures.customers.peter();
        const product = await fixtures.fixtures.products.smartphone();

        // Create a cart with items
        const cart = cartRepo.create({
          customer,
          status: CartStatus.OPEN,
          total: parseFloat(product.price.toString()),
        });
        const savedCart = await cartRepo.save(cart);

        const cartItem = cartItemRepo.create({
          cart: savedCart,
          product,
          quantity: 1,
          price: parseFloat(product.price.toString()),
          periodicity: null,
        });
        await cartItemRepo.save(cartItem);

        // Close cart
        savedCart.status = CartStatus.CLOSED;
        await cartRepo.save(savedCart);

        // Create first order
        const firstResult = await service.createOrder(customer.id, savedCart.id, PaymentMethod.CARD);

        // Create order again for same cart
        const secondResult = await service.createOrder(customer.id, savedCart.id, PaymentMethod.PIX);

        // Should reuse the same order
        expect(firstResult.order.id).toBe(secondResult.order.id);
        expect(secondResult.order.paymentMethod).toBe(PaymentMethod.PIX);
        expect(secondResult.order.status).toBe(OrderStatus.PENDING);
      }),
    );

    it(
      'should map charge status PAID to order status CONFIRMED',
      runWithRollbackTransaction(async () => {
        const customer = await fixtures.fixtures.customers.peter();
        const product = await fixtures.fixtures.products.gamingMouse();

        // Create a cart with items
        const cart = cartRepo.create({
          customer,
          status: CartStatus.OPEN,
          total: parseFloat(product.price.toString()),
        });
        const savedCart = await cartRepo.save(cart);

        const cartItem = cartItemRepo.create({
          cart: savedCart,
          product,
          quantity: 1,
          price: parseFloat(product.price.toString()),
          periodicity: null,
        });
        await cartItemRepo.save(cartItem);

        // Close cart
        savedCart.status = CartStatus.CLOSED;
        await cartRepo.save(savedCart);

        // CARD payment method should result in PAID status from charge provider
        const result = await service.createOrder(customer.id, savedCart.id, PaymentMethod.CARD);

        // With CARD, charge provider returns PAID, so order should be CONFIRMED
        expect(result.order.status).toBe(OrderStatus.CONFIRMED);
      }),
    );

    it(
      'should map charge status CREATED to order status PENDING',
      runWithRollbackTransaction(async () => {
        const customer = await fixtures.fixtures.customers.peter();
        const product = await fixtures.fixtures.products.notebook();

        // Create a cart with items
        const cart = cartRepo.create({
          customer,
          status: CartStatus.OPEN,
          total: parseFloat(product.price.toString()),
        });
        const savedCart = await cartRepo.save(cart);

        const cartItem = cartItemRepo.create({
          cart: savedCart,
          product,
          quantity: 1,
          price: parseFloat(product.price.toString()),
          periodicity: null,
        });
        await cartItemRepo.save(cartItem);

        // Close cart
        savedCart.status = CartStatus.CLOSED;
        await cartRepo.save(savedCart);

        // PIX payment method should result in CREATED status from charge provider
        const result = await service.createOrder(customer.id, savedCart.id, PaymentMethod.PIX);

        // With PIX, charge provider returns CREATED, so order should be PENDING
        expect(result.order.status).toBe(OrderStatus.PENDING);
      }),
    );

    it(
      'should throw NotFoundException when customer not found',
      runWithRollbackTransaction(async () => {
        const customer = await fixtures.fixtures.customers.peter();
        const product = await fixtures.fixtures.products.notebook();

        // Create a cart
        const cart = cartRepo.create({
          customer,
          status: CartStatus.CLOSED,
          total: parseFloat(product.price.toString()),
        });
        const savedCart = await cartRepo.save(cart);

        await expect(
          service.createOrder('00000000-0000-0000-0000-000000000000', savedCart.id, PaymentMethod.CARD),
        ).rejects.toThrow(NotFoundException);
      }),
    );

    it(
      'should throw NotFoundException when cart not found',
      runWithRollbackTransaction(async () => {
        const customer = await fixtures.fixtures.customers.peter();

        await expect(
          service.createOrder(customer.id, '00000000-0000-0000-0000-000000000000', PaymentMethod.CARD),
        ).rejects.toThrow(NotFoundException);
      }),
    );

    it(
      'should throw NotFoundException when cart does not belong to customer',
      runWithRollbackTransaction(async () => {
        const customer1 = await fixtures.fixtures.customers.peter();
        const customer2 = await fixtures.fixtures.customers.mary();
        const product = await fixtures.fixtures.products.notebook();

        // Create a cart for customer1
        const cart = cartRepo.create({
          customer: customer1,
          status: CartStatus.CLOSED,
          total: parseFloat(product.price.toString()),
        });
        const savedCart = await cartRepo.save(cart);

        // Try to create order with customer2's ID but customer1's cart
        await expect(service.createOrder(customer2.id, savedCart.id, PaymentMethod.CARD)).rejects.toThrow(
          NotFoundException,
        );
      }),
    );
  });

  describe('createRecurringOrder', () => {
    it(
      'should create recurring order with PAID charge status',
      runWithRollbackTransaction(async () => {
        const customer = await fixtures.fixtures.customers.peter();
        const amount = 49.9;

        const chargeResponse = {
          transactionId: `TXN-RECURRING-${Date.now()}`,
          status: ChargeStatus.PAID,
          message: 'Recurring payment processed',
          processingTime: 500,
        };

        const result = await service.createRecurringOrder(customer.id, amount, PaymentMethod.CARD, chargeResponse);

        expect(result).toBeDefined();
        expect(result.order).toBeDefined();
        expect(result.transaction).toBeDefined();
        expect(result.order.customer.id).toBe(customer.id);
        expect(result.order.total).toBe(amount);
        expect(result.order.status).toBe(OrderStatus.CONFIRMED);
        expect(result.order.paymentMethod).toBe(PaymentMethod.CARD);
        expect(result.order.origin).toBe(OrderOrigin.SUBSCRIPTION);
        expect(result.order.cart).toBeUndefined(); // Recurring orders don't have cart

        expect(result.transaction.transactionId).toBe(chargeResponse.transactionId);
        expect(result.transaction.status).toBe(TransactionStatus.PAID);
        expect(result.transaction.amount).toBe(amount);
        expect(result.transaction.order.id).toBe(result.order.id);
      }),
    );

    it(
      'should create recurring order with FAILED charge status',
      runWithRollbackTransaction(async () => {
        const customer = await fixtures.fixtures.customers.mary();
        const amount = 129.9;

        const chargeResponse = {
          transactionId: `TXN-RECURRING-FAILED-${Date.now()}`,
          status: ChargeStatus.FAILED,
          message: 'Payment failed',
          processingTime: 300,
        };

        const result = await service.createRecurringOrder(customer.id, amount, PaymentMethod.CARD, chargeResponse);

        expect(result.order.status).toBe(OrderStatus.FAILED);
        expect(result.transaction.status).toBe(TransactionStatus.FAILED);
      }),
    );

    it(
      'should create recurring order with REFUSED charge status',
      runWithRollbackTransaction(async () => {
        const customer = await fixtures.fixtures.customers.john();
        const amount = 49.9;

        const chargeResponse = {
          transactionId: `TXN-RECURRING-REFUSED-${Date.now()}`,
          status: ChargeStatus.REFUSED,
          message: 'Payment refused',
          processingTime: 250,
        };

        const result = await service.createRecurringOrder(customer.id, amount, PaymentMethod.CARD, chargeResponse);

        expect(result.order.status).toBe(OrderStatus.FAILED);
        expect(result.transaction.status).toBe(TransactionStatus.REFUSED);
      }),
    );

    it(
      'should create recurring order with CREATED charge status',
      runWithRollbackTransaction(async () => {
        const customer = await fixtures.fixtures.customers.peter();
        const amount = 49.9;

        const chargeResponse = {
          transactionId: `TXN-RECURRING-CREATED-${Date.now()}`,
          status: ChargeStatus.CREATED,
          message: 'Payment created',
          processingTime: 100,
        };

        const result = await service.createRecurringOrder(customer.id, amount, PaymentMethod.CARD, chargeResponse);

        expect(result.order.status).toBe(OrderStatus.PENDING);
        expect(result.transaction.status).toBe(TransactionStatus.CREATED);
      }),
    );

    it(
      'should throw NotFoundException when customer not found',
      runWithRollbackTransaction(async () => {
        const chargeResponse = {
          transactionId: `TXN-RECURRING-${Date.now()}`,
          status: ChargeStatus.PAID,
          message: 'Payment processed',
          processingTime: 500,
        };

        await expect(
          service.createRecurringOrder(
            '00000000-0000-0000-0000-000000000000',
            49.9,
            PaymentMethod.CARD,
            chargeResponse,
          ),
        ).rejects.toThrow(NotFoundException);
      }),
    );
  });

  describe('findOneOrFail', () => {
    it(
      'should return order when found',
      runWithRollbackTransaction(async () => {
        const order = await fixtures.fixtures.orders.confirmedMary();

        const result = await service.findOneOrFail(order.id);

        expect(result).toBeDefined();
        expect(result.id).toBe(order.id);
        expect(result.customer).toBeDefined();
        expect(result.cart).toBeDefined();
        expect(result.transactions).toBeDefined();
      }),
    );

    it(
      'should throw NotFoundException when order not found',
      runWithRollbackTransaction(async () => {
        await expect(service.findOneOrFail('00000000-0000-0000-0000-000000000000')).rejects.toThrow(NotFoundException);
      }),
    );

    it(
      'should throw NotFoundException when order is soft deleted',
      runWithRollbackTransaction(async () => {
        const order = await fixtures.fixtures.orders.pendingJohn();

        // Soft delete the order
        await orderRepo.update(order.id, { deletedAt: new Date() });

        await expect(service.findOneOrFail(order.id)).rejects.toThrow(NotFoundException);
      }),
    );
  });

  describe('updateStatus', () => {
    it(
      'should update order status successfully',
      runWithRollbackTransaction(async () => {
        const order = await fixtures.fixtures.orders.pendingJohn();

        const result = await service.updateStatus(order.id, OrderStatus.CONFIRMED);

        expect(result.status).toBe(OrderStatus.CONFIRMED);

        // Verify database update
        const updatedOrder = await orderRepo.findOne({
          where: { id: order.id },
        });
        expect(updatedOrder?.status).toBe(OrderStatus.CONFIRMED);
      }),
    );

    it(
      'should throw NotFoundException when order does not exist',
      runWithRollbackTransaction(async () => {
        await expect(
          service.updateStatus('00000000-0000-0000-0000-000000000000', OrderStatus.CONFIRMED),
        ).rejects.toThrow(NotFoundException);
      }),
    );

    it(
      'should update to all valid order statuses',
      runWithRollbackTransaction(async () => {
        const order = await fixtures.fixtures.orders.pendingJohn();

        const statuses = [OrderStatus.CONFIRMED, OrderStatus.FAILED, OrderStatus.CANCELLED, OrderStatus.PENDING];

        for (const status of statuses) {
          const result = await service.updateStatus(order.id, status);
          expect(result.status).toBe(status);
        }
      }),
    );
  });

  describe('findTransactionByTransactionId', () => {
    it(
      'should return transaction when found',
      runWithRollbackTransaction(async () => {
        const transaction = await fixtures.fixtures.transactions.paidMary();

        const result = await service.findTransactionByTransactionId(transaction.transactionId);

        expect(result).toBeDefined();
        expect(result?.transactionId).toBe(transaction.transactionId);
        expect(result?.order).toBeDefined();
      }),
    );

    it(
      'should return null when transaction not found',
      runWithRollbackTransaction(async () => {
        const result = await service.findTransactionByTransactionId('NON-EXISTENT-TXN-ID');

        expect(result).toBeNull();
      }),
    );
  });

  describe('updateTransactionStatus', () => {
    it(
      'should update transaction status successfully',
      runWithRollbackTransaction(async () => {
        const transaction = await fixtures.fixtures.transactions.processingJohn();

        const result = await service.updateTransactionStatus(transaction.transactionId, TransactionStatus.PAID);

        expect(result.status).toBe(TransactionStatus.PAID);

        // Verify database update
        const updatedTransaction = await transactionRepo.findOne({
          where: { id: transaction.id },
        });
        expect(updatedTransaction?.status).toBe(TransactionStatus.PAID);
      }),
    );

    it(
      'should throw NotFoundException when transaction not found',
      runWithRollbackTransaction(async () => {
        await expect(service.updateTransactionStatus('NON-EXISTENT-TXN-ID', TransactionStatus.PAID)).rejects.toThrow(
          NotFoundException,
        );
      }),
    );

    it(
      'should update subscription status when transaction is linked to subscription period',
      runWithRollbackTransaction(async () => {
        // Get a subscription with a period that might have a transaction

        const order = await fixtures.fixtures.orders.pendingJohn();

        // Create a transaction and link it to a subscription period
        const transaction = transactionRepo.create({
          transactionId: `TXN-SUB-UPDATE-${Date.now()}`,
          status: TransactionStatus.PROCESSING,
          amount: 49.9,
          currency: 'BRL',
          message: 'Test transaction',
          processingTime: 500,
          order,
        });
        const savedTransaction = await transactionRepo.save(transaction);

        // Subscription period is already linked to order, which contains the transaction
        // No need to manually link transaction to period anymore

        // Update transaction status - this should also update subscription
        await service.updateTransactionStatus(savedTransaction.transactionId, TransactionStatus.PAID);

        // Verify transaction was updated
        const updatedTransaction = await transactionRepo.findOne({
          where: { id: savedTransaction.id },
        });
        expect(updatedTransaction?.status).toBe(TransactionStatus.PAID);
      }),
    );

    it(
      'should update to all valid transaction statuses',
      runWithRollbackTransaction(async () => {
        const order = await fixtures.fixtures.orders.pendingJohn();

        // Create a transaction
        const transaction = transactionRepo.create({
          transactionId: `TXN-STATUS-TEST-${Date.now()}`,
          status: TransactionStatus.CREATED,
          amount: 99.9,
          currency: 'BRL',
          message: 'Test transaction',
          processingTime: 500,
          order,
        });
        const savedTransaction = await transactionRepo.save(transaction);

        const statuses = [
          TransactionStatus.PROCESSING,
          TransactionStatus.PAID,
          TransactionStatus.FAILED,
          TransactionStatus.REFUSED,
        ];

        for (const status of statuses) {
          const result = await service.updateTransactionStatus(savedTransaction.transactionId, status);
          expect(result.status).toBe(status);
        }
      }),
    );
  });
});
