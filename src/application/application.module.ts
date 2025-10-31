import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CustomerApplicationModule } from './customer/customer.module';
import { ProductApplicationModule } from './product/product.module';
import { CartApplicationModule } from './cart/cart.module';

@Module({
  imports: [CustomerApplicationModule, ProductApplicationModule, AuthModule, CartApplicationModule],
})
export class ApplicationModule {}
