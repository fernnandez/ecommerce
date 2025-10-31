import { Module } from '@nestjs/common';
import { CustomerApplicationModule } from './customer/customer.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [CustomerApplicationModule, AuthModule],
})
export class ApplicationModule {}
