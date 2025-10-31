import { CustomerModule } from '@domain/customer/customer.module';
import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';

@Module({
  imports: [CustomerModule],
  controllers: [CustomerController],
})
export class CustomerApplicationModule {}
