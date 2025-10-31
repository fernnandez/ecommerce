import { Module } from '@nestjs/common';
import { CartModule } from './cart/cart.module';
import { CustomerModule } from './customer/customer.module';
import { OrderModule } from './order/order.module';
import { ProductModule } from './product/product.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    UserModule,
    CustomerModule,
    ProductModule,
    CartModule,
    OrderModule,
    SubscriptionModule,
  ],
  exports: [
    UserModule,
    CustomerModule,
    ProductModule,
    CartModule,
    OrderModule,
    SubscriptionModule,
  ],
})
export class DomainModule {}
