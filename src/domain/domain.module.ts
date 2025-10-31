import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { CustomerModule } from './customer/customer.module';
import { ProductModule } from './product/product.module';
import { CartModule } from './cart/cart.module';

@Module({
  imports: [UserModule, CustomerModule, ProductModule, CartModule],
  exports: [UserModule, CustomerModule, ProductModule, CartModule],
})
export class DomainModule {}
