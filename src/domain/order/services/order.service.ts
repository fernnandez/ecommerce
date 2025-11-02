import { Cart } from '@domain/cart/entities/cart.entity';
import { CartItem } from '@domain/cart/entities/cart-item.entity';
import { CartService } from '@src/domain/cart/services/cart.service';
import { Customer } from '@domain/customer/entities/customer.entity';
import { Order, OrderOrigin, OrderStatus, PaymentMethod } from '@domain/order/entities/order.entity';
import { Transaction, TransactionStatus } from '@domain/order/entities/transaction.entity';
import { Periodicity as ProductPeriodicity, ProductType } from '@domain/product/entities/product.entity';
import { Periodicity as SubscriptionPeriodicity } from '@domain/subscription/entities/subscription.entity';
import { SubscriptionService } from '@src/domain/subscription/services/subscription.service';
import {
  CHARGE_PROVIDER_TOKEN,
  ChargeRequest,
  ChargeResponse,
  ChargeStatus,
  IChargeProvider,
  PaymentMethod as IntegrationPaymentMethod,
} from '@integration/charge/interfaces/charge-provider.interface';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @Inject(forwardRef(() => CartService))
    private readonly cartService: CartService,
    @Inject(CHARGE_PROVIDER_TOKEN)
    private readonly chargeProvider: IChargeProvider,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Transactional()
  async createOrder(
    customerId: string,
    cartId: string,
    paymentMethod: PaymentMethod,
  ): Promise<{ order: Order; subscriptionIds: string[] }> {
    const { customer, cart } = await this.validateOrderCreation(customerId, cartId);

    const existingOrder = await this.findOrCreateOrder(customer, cart, cartId, paymentMethod);

    if (this.hasActiveTransaction(existingOrder)) {
      throw new BadRequestException('Order already has an active transaction');
    }

    const savedOrder = await this.orderRepository.save(existingOrder);

    const chargeResponse = await this.processPayment(customer, cart, paymentMethod);
    const updatedOrder = await this.updateOrderStatus(savedOrder, chargeResponse.status);

    await this.createTransaction(updatedOrder, chargeResponse, cart.total);

    const orderWithTransactions = await this.getOrderWithTransactions(updatedOrder.id);
    const subscriptionIds = await this.createSubscriptionsForCart(
      cart,
      customer,
      orderWithTransactions,
      chargeResponse.status,
    );

    return { order: updatedOrder, subscriptionIds };
  }

  private async validateOrderCreation(customerId: string, cartId: string): Promise<{ customer: Customer; cart: Cart }> {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
      relations: ['user'],
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const cart = await this.cartService.getCartById(cartId);

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    if (cart.customer.id !== customerId) {
      throw new NotFoundException('Cart does not belong to customer');
    }

    return { customer, cart };
  }

  private async findOrCreateOrder(
    customer: Customer,
    cart: Cart,
    cartId: string,
    paymentMethod: PaymentMethod,
  ): Promise<Order> {
    const existingOrder = await this.orderRepository.findOne({
      where: { cart: { id: cartId }, deletedAt: null },
      relations: ['cart', 'customer', 'transactions'],
    });

    if (existingOrder) {
      return existingOrder;
    }

    return this.orderRepository.create({
      customer,
      cart,
      total: cart.total,
      status: OrderStatus.PENDING,
      paymentMethod,
      origin: OrderOrigin.CART,
    });
  }

  private hasActiveTransaction(order: Order): boolean {
    return (
      order.transactions?.some(
        t => (t.status === TransactionStatus.PROCESSING || t.status === TransactionStatus.CREATED) && !t.deletedAt,
      ) ?? false
    );
  }

  private buildChargeRequest(customer: Customer, cart: Cart, paymentMethod: PaymentMethod): ChargeRequest {
    return {
      amount: Number(cart.total),
      currency: 'BRL',
      paymentMethod: this.mapPaymentMethodToIntegration(paymentMethod),
      reference: cart.id,
      customerEmail: customer.user?.email,
      customerName: customer.user?.name,
    };
  }

  private async processPayment(customer: Customer, cart: Cart, paymentMethod: PaymentMethod): Promise<ChargeResponse> {
    const chargeRequest = this.buildChargeRequest(customer, cart, paymentMethod);
    return await this.chargeProvider.charge(chargeRequest);
  }

  private mapChargeStatusToOrderStatus(chargeStatus: ChargeStatus): OrderStatus {
    const statusMapping: Record<ChargeStatus, OrderStatus> = {
      [ChargeStatus.PAID]: OrderStatus.CONFIRMED,
      [ChargeStatus.REFUSED]: OrderStatus.FAILED,
      [ChargeStatus.FAILED]: OrderStatus.FAILED,
      [ChargeStatus.CREATED]: OrderStatus.PENDING,
      [ChargeStatus.PROCESSING]: OrderStatus.PENDING,
    };

    return statusMapping[chargeStatus];
  }

  private async updateOrderStatus(order: Order, chargeStatus: ChargeStatus): Promise<Order> {
    order.status = this.mapChargeStatusToOrderStatus(chargeStatus);
    return await this.orderRepository.save(order);
  }

  private async createTransaction(order: Order, chargeResponse: ChargeResponse, cartTotal: number): Promise<void> {
    const transaction = this.transactionRepository.create({
      transactionId: chargeResponse.transactionId,
      status: this.mapChargeStatusToTransactionStatus(chargeResponse.status),
      amount: Number(cartTotal),
      currency: 'BRL',
      message: chargeResponse.message,
      processingTime: chargeResponse.processingTime,
      order,
    });

    await this.transactionRepository.save(transaction);
  }

  private async getOrderWithTransactions(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['transactions'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  private shouldCreateSubscriptions(cart: Cart, chargeStatus: ChargeStatus): boolean {
    const hasSubscriptionProducts = cart.items?.some(item => item.product?.type === ProductType.SUBSCRIPTION);
    const isChargeProcessable =
      chargeStatus === ChargeStatus.PAID ||
      chargeStatus === ChargeStatus.CREATED ||
      chargeStatus === ChargeStatus.PROCESSING;

    return Boolean(hasSubscriptionProducts && cart.items && isChargeProcessable);
  }

  private async createSubscriptionsForCart(
    cart: Cart,
    customer: Customer,
    order: Order,
    chargeStatus: ChargeStatus,
  ): Promise<string[]> {
    if (!this.shouldCreateSubscriptions(cart, chargeStatus)) {
      return [];
    }

    const subscriptionItems = cart.items.filter(
      item => item.product?.type === ProductType.SUBSCRIPTION && item.product.periodicity,
    );

    const subscriptionIds: string[] = [];

    for (const item of subscriptionItems) {
      if (item.product?.periodicity) {
        try {
          const subscription = await this.createSubscriptionForItem(customer, item, order);
          subscriptionIds.push(subscription.id);
        } catch (error) {
          Logger.warn(`Failed to create subscription for product ${item.product.id}: ${error.message}`);
        }
      }
    }

    return subscriptionIds;
  }

  private async createSubscriptionForItem(customer: Customer, item: CartItem, order: Order) {
    const subscriptionPeriodicity = this.mapProductPeriodicityToSubscriptionPeriodicity(item.product.periodicity);
    return await this.subscriptionService.create(
      customer,
      item.product,
      Number(item.price),
      subscriptionPeriodicity,
      order,
    );
  }

  async findOneOrFail(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id, deletedAt: null },
      relations: ['customer', 'cart', 'transactions'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async findByCustomer(customerId: string): Promise<Order[]> {
    return await this.orderRepository.find({
      where: { customer: { id: customerId }, deletedAt: null },
      relations: ['customer', 'cart', 'transactions'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = await this.findOneOrFail(id);
    order.status = status;
    return await this.orderRepository.save(order);
  }

  async findTransactionByTransactionId(transactionId: string): Promise<Transaction | null> {
    return await this.transactionRepository.findOne({
      where: { transactionId },
      relations: ['order', 'order.customer'],
    });
  }

  async updateTransactionStatus(transactionId: string, status: TransactionStatus): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { transactionId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    transaction.status = status;
    const savedTransaction = await this.transactionRepository.save(transaction);

    await this.subscriptionService.findAndUpdateSubscriptionByTransaction(transactionId, status);

    return savedTransaction;
  }

  @Transactional()
  async createRecurringOrder(
    customerId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    chargeResponse: {
      transactionId: string;
      status: ChargeStatus;
      message?: string;
      processingTime: number;
      gateway?: string;
    },
  ): Promise<{ order: Order; transaction: Transaction }> {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
      relations: ['user'],
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    let orderStatus: OrderStatus;
    if (chargeResponse.status === ChargeStatus.PAID) {
      orderStatus = OrderStatus.CONFIRMED;
    } else if (chargeResponse.status === ChargeStatus.REFUSED || chargeResponse.status === ChargeStatus.FAILED) {
      orderStatus = OrderStatus.FAILED;
    } else {
      orderStatus = OrderStatus.PENDING;
    }

    const order = this.orderRepository.create({
      customer,
      total: amount,
      status: orderStatus,
      paymentMethod,
      origin: OrderOrigin.SUBSCRIPTION,
    });

    const savedOrder = await this.orderRepository.save(order);

    const transaction = this.transactionRepository.create({
      transactionId: chargeResponse.transactionId,
      status: this.mapChargeStatusToTransactionStatus(chargeResponse.status),
      amount,
      currency: 'BRL',
      message: chargeResponse.message,
      processingTime: chargeResponse.processingTime,
      order: savedOrder,
    });

    const savedTransaction = await this.transactionRepository.save(transaction);

    return { order: savedOrder, transaction: savedTransaction };
  }

  private mapPaymentMethodToIntegration(domainPaymentMethod: PaymentMethod): IntegrationPaymentMethod {
    const mapping: Record<PaymentMethod, IntegrationPaymentMethod> = {
      [PaymentMethod.CARD]: IntegrationPaymentMethod.CARD,
      [PaymentMethod.SLIPBANK]: IntegrationPaymentMethod.SLIPBANK,
      [PaymentMethod.PIX]: IntegrationPaymentMethod.PIX,
    };

    return mapping[domainPaymentMethod];
  }

  private mapChargeStatusToTransactionStatus(chargeStatus: ChargeStatus): TransactionStatus {
    const mapping: Record<ChargeStatus, TransactionStatus> = {
      [ChargeStatus.CREATED]: TransactionStatus.CREATED,
      [ChargeStatus.FAILED]: TransactionStatus.FAILED,
      [ChargeStatus.PAID]: TransactionStatus.PAID,
      [ChargeStatus.REFUSED]: TransactionStatus.REFUSED,
      [ChargeStatus.PROCESSING]: TransactionStatus.PROCESSING,
    };

    return mapping[chargeStatus];
  }

  private mapProductPeriodicityToSubscriptionPeriodicity(
    productPeriodicity: ProductPeriodicity,
  ): SubscriptionPeriodicity {
    const mapping: Record<ProductPeriodicity, SubscriptionPeriodicity> = {
      [ProductPeriodicity.MONTHLY]: SubscriptionPeriodicity.MONTHLY,
      [ProductPeriodicity.QUARTERLY]: SubscriptionPeriodicity.QUARTERLY,
      [ProductPeriodicity.YEARLY]: SubscriptionPeriodicity.YEARLY,
    };

    return mapping[productPeriodicity];
  }
}
