import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { CustomerModule } from './customer/customer.module';

@Module({
  imports: [UserModule, CustomerModule],
  exports: [UserModule, CustomerModule],
})
export class DomainModule {}
