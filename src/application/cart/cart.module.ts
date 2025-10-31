import { CartModule } from '@domain/cart/cart.module';
import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';

@Module({
  imports: [CartModule],
  controllers: [CartController],
})
export class CartApplicationModule {}

