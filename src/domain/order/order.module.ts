import { CartModule } from '@domain/cart/cart.module';
import { CustomerModule } from '@domain/customer/customer.module';
import { Customer } from '@domain/customer/entities/customer.entity';
import { SubscriptionModule } from '@domain/subscription/subscription.module';
import { IntegrationModule } from '@integration/integration.module';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { Transaction } from './entities/transaction.entity';
import { OrderService } from './services/order.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Transaction, Customer]),
    forwardRef(() => CartModule),
    CustomerModule,
    SubscriptionModule,
    IntegrationModule,
  ],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
