import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CartApplicationModule } from './cart/cart.module';
import { CustomerApplicationModule } from './customer/customer.module';
import { ProductApplicationModule } from './product/product.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [CustomerApplicationModule, ProductApplicationModule, AuthModule, CartApplicationModule, WebhookModule],
})
export class ApplicationModule {}
