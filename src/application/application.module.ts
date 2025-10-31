import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CustomerApplicationModule } from './customer/customer.module';
import { ProductApplicationModule } from './product/product.module';

@Module({
  imports: [CustomerApplicationModule, ProductApplicationModule, AuthModule],
})
export class ApplicationModule {}
