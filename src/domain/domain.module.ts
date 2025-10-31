import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { CustomerModule } from './customer/customer.module';
import { ProductModule } from './product/product.module';

@Module({
  imports: [UserModule, CustomerModule, ProductModule],
  exports: [UserModule, CustomerModule, ProductModule],
})
export class DomainModule {}
