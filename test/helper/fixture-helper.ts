import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Cart, CartStatus } from '@src/domain/cart/entities/cart.entity';
import { Customer } from '@src/domain/customer/entities/customer.entity';
import { Order, OrderStatus } from '@src/domain/order/entities/order.entity';
import { Transaction, TransactionStatus } from '@src/domain/order/entities/transaction.entity';
import { Product } from '@src/domain/product/entities/product.entity';
import { Subscription } from '@src/domain/subscription/entities/subscription.entity';
import { User } from '@src/domain/user/entities/user.entity';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { FindOptionsWhere, Repository } from 'typeorm';

/**
 * Helper to access fixtures loaded in the test database
 */
export class FixtureHelper {
  private userRepo: Repository<User>;
  private customerRepo: Repository<Customer>;
  private productRepo: Repository<Product>;
  private cartRepo: Repository<Cart>;
  private subscriptionRepo: Repository<Subscription>;
  private transactionRepo: Repository<Transaction>;
  private orderRepo: Repository<Order>;

  constructor(private app: INestApplication) {
    this.userRepo = app.get<Repository<User>>(getRepositoryToken(User));
    this.customerRepo = app.get<Repository<Customer>>(getRepositoryToken(Customer));
    this.productRepo = app.get<Repository<Product>>(getRepositoryToken(Product));
    this.cartRepo = app.get<Repository<Cart>>(getRepositoryToken(Cart));
    this.subscriptionRepo = app.get<Repository<Subscription>>(getRepositoryToken(Subscription));
    this.transactionRepo = app.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    this.orderRepo = app.get<Repository<Order>>(getRepositoryToken(Order));
  }

  /**
   * Get user from fixtures by email
   */
  async getUser(email: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { email },
      relations: ['customer'],
    });

    if (!user) {
      throw new Error(`User fixture not found: ${email}`);
    }

    return user;
  }

  /**
   * Get customer from fixtures by user email
   */
  async getCustomer(userEmail: string): Promise<Customer> {
    const user = await this.getUser(userEmail);
    if (!user.customer) {
      throw new Error(`Customer fixture not found for user: ${userEmail}`);
    }
    return user.customer;
  }

  /**
   * Get product from fixtures by name
   */
  async getProduct(name: string): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { name },
    });

    if (!product) {
      throw new Error(`Product fixture not found: ${name}`);
    }

    return product;
  }

  /**
   * Get cart from fixtures by customer email and status
   */
  async getCart(customerEmail: string, status: 'open' | 'closed' = 'open'): Promise<Cart | null> {
    const customer = await this.getCustomer(customerEmail);
    const cart = await this.cartRepo.findOne({
      where: {
        customer: { id: customer.id },
        status: status as CartStatus,
      },
      relations: ['items', 'items.product'],
    });

    return cart;
  }

  /**
   * Get JWT token for a user from fixtures
   * Uses default password from fixtures
   */
  async getToken(userEmail: string, password: string = 'password123'): Promise<string> {
    // First try to login (if password is correct)
    try {
      const loginRes = await request(this.app.getHttpServer()).post('/auth/login').send({
        email: userEmail,
        password,
      });

      if (loginRes.status === 200) {
        return loginRes.body.accessToken;
      }
    } catch {
      // If login fails, the password in fixtures might be hashed
      // We'll need to check the actual password hash or reset it
    }

    // If login failed, the password in fixtures is hashed
    // Get the user and check if we need to update password
    const user = await this.getUser(userEmail);
    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      // Update user password to allow login
      const hashedPassword = await bcrypt.hash(password, 10);
      await this.userRepo.update(user.id, { password: hashedPassword });
    }

    // Try login again
    const loginRes = await request(this.app.getHttpServer())
      .post('/auth/login')
      .send({
        email: userEmail,
        password,
      })
      .expect(200);

    return loginRes.body.accessToken;
  }

  /**
   * Predefined fixture accessors for common scenarios
   */
  fixtures = {
    users: {
      admin: () => this.getUser('admin@system.com'),
      john: () => this.getUser('john.silva@email.com'),
      mary: () => this.getUser('mary.oliveira@email.com'),
      peter: () => this.getUser('peter.santos@email.com'),
    },
    customers: {
      john: () => this.getCustomer('john.silva@email.com'),
      mary: () => this.getCustomer('mary.oliveira@email.com'),
      peter: () => this.getCustomer('peter.santos@email.com'),
    },
    products: {
      notebook: () => this.getProduct('Notebook Dell Inspiron'),
      smartphone: () => this.getProduct('Smartphone Samsung Galaxy'),
      gamingMouse: () => this.getProduct('RGB Gaming Mouse'),
      monthlySubscription: () => this.getProduct('Premium Monthly Plan'),
      quarterlySubscription: () => this.getProduct('Pro Quarterly Plan'),
      yearlySubscription: () => this.getProduct('Enterprise Yearly Plan'),
    },
    subscriptions: {
      activeMonthlyJohn: () => this.getSubscription('SUB-001-JOHN-MONTHLY'),
      pendingQuarterlyMary: () => this.getSubscription('SUB-002-MARY-QUARTERLY'),
      pastDueYearlyPeter: () => this.getSubscription('SUB-003-PETER-YEARLY'),
    },
    orders: {
      confirmedMary: () => this.getOrder('mary.oliveira@email.com', 'confirmed'),
      pendingJohn: () => this.getOrder('john.silva@email.com', 'pending'),
      cancelledPeter: () => this.getOrder('peter.santos@email.com', 'cancelled'),
    },
    transactions: {
      paidMary: () => this.getTransaction('TXN-001-MARY-CARD'),
      processingJohn: () => this.getTransaction('TXN-002-JOHN-PIX'),
      refusedPeter: () => this.getTransaction('TXN-003-PETER-BANK'),
      paid: (amount = 49.9) => this.createMockTransaction(TransactionStatus.PAID, amount),
      processing: (amount = 49.9) => this.createMockTransaction(TransactionStatus.PROCESSING, amount),
      failed: (amount = 49.9) => this.createMockTransaction(TransactionStatus.FAILED, amount),
    },
    tokens: {
      admin: () => this.getToken('admin@system.com'),
      john: () => this.getToken('john.silva@email.com'),
      mary: () => this.getToken('mary.oliveira@email.com'),
      peter: () => this.getToken('peter.santos@email.com'),
    },
  };

  /**
   * Get subscription from fixtures by subscriptionId
   */
  async getSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { subscriptionId },
      relations: ['customer', 'product', 'periods', 'periods.order'],
    });

    if (!subscription) {
      throw new Error(`Subscription fixture not found: ${subscriptionId}`);
    }

    return subscription;
  }

  /**
   * Get order from fixtures by customer email and status or by cart ID
   */
  async getOrder(customerEmail: string, status?: string): Promise<Order> {
    const customer = await this.getCustomer(customerEmail);
    const where: FindOptionsWhere<Order> = { customer: { id: customer.id } };
    if (status) {
      where.status = status as OrderStatus;
    }

    const order = await this.orderRepo.findOne({
      where,
      relations: ['customer', 'cart', 'transactions'],
      order: { createdAt: 'DESC' },
    });

    if (!order) {
      throw new Error(
        `Order fixture not found for customer: ${customerEmail}${status ? ` with status: ${status}` : ''}`,
      );
    }

    return order;
  }

  /**
   * Get transaction from fixtures by transactionId
   */
  async getTransaction(transactionId: string): Promise<Transaction> {
    const transaction = await this.transactionRepo.findOne({
      where: { transactionId },
      relations: ['order', 'order.customer'],
    });

    if (!transaction) {
      throw new Error(`Transaction fixture not found: ${transactionId}`);
    }

    return transaction;
  }

  /**
   * Create a mock transaction for testing
   */
  private async createMockTransaction(status: TransactionStatus, amount: number): Promise<Transaction> {
    const transaction = this.transactionRepo.create({
      transactionId: `TXN-${status}-${Date.now()}`,
      status,
      amount,
      currency: 'BRL',
      message: `Mock transaction ${status}`,
      processingTime: 500,
    });

    return await this.transactionRepo.save(transaction);
  }
}
