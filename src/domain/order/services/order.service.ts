import { CartService } from '@domain/cart/cart.service';
import { CustomerService } from '@domain/customer/customer.service';
import { Customer } from '@domain/customer/entities/customer.entity';
import { Order, OrderStatus, PaymentMethod } from '@domain/order/entities/order.entity';
import { Transaction, TransactionStatus } from '@domain/order/entities/transaction.entity';
import { Periodicity as ProductPeriodicity, ProductType } from '@domain/product/entities/product.entity';
import { Periodicity as SubscriptionPeriodicity } from '@domain/subscription/entities/subscription.entity';
import { SubscriptionService } from '@domain/subscription/subscription.service';
import {
  CHARGE_PROVIDER_TOKEN,
  ChargeRequest,
  ChargeStatus,
  IChargeProvider,
  PaymentMethod as IntegrationPaymentMethod,
} from '@integration/charge/interfaces/charge-provider.interface';
import { Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
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
    private readonly customerService: CustomerService,
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

    let order = await this.orderRepository.findOne({
      where: { cart: { id: cartId }, deletedAt: null },
      relations: ['cart', 'customer'],
    });

    if (order) {
      order.status = OrderStatus.PENDING;
      order.paymentMethod = paymentMethod;
      order.total = cart.total;
    } else {
      order = this.orderRepository.create({
        customer,
        cart,
        total: cart.total,
        status: OrderStatus.PENDING,
        paymentMethod,
      });
    }

    const savedOrder = await this.orderRepository.save(order);

    const chargeRequest: ChargeRequest = {
      amount: Number(cart.total),
      currency: 'BRL',
      paymentMethod: this.mapPaymentMethodToIntegration(paymentMethod),
      reference: cartId,
      customerEmail: customer.user?.email,
      customerName: customer.user?.name,
    };

    const chargeResponse = await this.chargeProvider.charge(chargeRequest);

    const statusMapping: Record<ChargeStatus, OrderStatus> = {
      [ChargeStatus.PAID]: OrderStatus.CONFIRMED,
      [ChargeStatus.REFUSED]: OrderStatus.FAILED,
      [ChargeStatus.FAILED]: OrderStatus.FAILED,
      [ChargeStatus.CREATED]: OrderStatus.PENDING,
      [ChargeStatus.PROCESSING]: OrderStatus.PENDING,
    };

    savedOrder.status = statusMapping[chargeResponse.status];

    const updatedOrder = await this.orderRepository.save(savedOrder);

    const transaction = this.transactionRepository.create({
      transactionId: chargeResponse.transactionId,
      status: this.mapChargeStatusToTransactionStatus(chargeResponse.status),
      amount: Number(cart.total),
      currency: chargeRequest.currency,
      message: chargeResponse.message,
      processingTime: chargeResponse.processingTime,
      order: updatedOrder,
    });

    const savedTransaction = await this.transactionRepository.save(transaction);

    const hasSubscriptionProducts = cart.items?.some(item => item.product?.type === ProductType.SUBSCRIPTION);

    const subscriptionIds: string[] = [];
    const shouldCreateSubscriptions =
      hasSubscriptionProducts &&
      cart.items &&
      (chargeResponse.status === ChargeStatus.PAID ||
        chargeResponse.status === ChargeStatus.CREATED ||
        chargeResponse.status === ChargeStatus.PROCESSING);

    if (shouldCreateSubscriptions) {
      const subscriptionItems = cart.items.filter(
        item => item.product?.type === ProductType.SUBSCRIPTION && item.product.periodicity,
      );

      // TODO: analisar processamento async aquiÞ
      for (const item of subscriptionItems) {
        if (item.product && item.product.periodicity) {
          try {
            const subscriptionPeriodicity = this.mapProductPeriodicityToSubscriptionPeriodicity(
              item.product.periodicity,
            );
            const subscription = await this.subscriptionService.create(
              customer,
              item.product,
              Number(item.price),
              subscriptionPeriodicity,
              savedTransaction,
            );
            subscriptionIds.push(subscription.id);
          } catch (error) {
            console.warn(`Failed to create subscription for product ${item.product.id}: ${error.message}`);
          }
        }
      }
    }

    return { order: updatedOrder, subscriptionIds };
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

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = await this.findOneOrFail(id);
    order.status = status;
    return await this.orderRepository.save(order);
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
