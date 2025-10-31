import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { Transaction } from './entities/transaction.entity';
import { OrderService } from './services/order.service';
import { CustomerModule } from '@domain/customer/customer.module';
import { Customer } from '@domain/customer/entities/customer.entity';
import { CartModule } from '@domain/cart/cart.module';
import { IntegrationModule } from '@integration/integration.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Transaction, Customer]),
    CustomerModule,
    forwardRef(() => CartModule),
    IntegrationModule,
  ],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}

