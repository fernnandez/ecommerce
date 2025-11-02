import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { CustomerService } from './services/customer.service';
import { UserModule } from '@domain/user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Customer]), UserModule],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
