import { OrderModule } from '@domain/order/order.module';
import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';

@Module({
  imports: [OrderModule],
  controllers: [OrderController],
})
export class OrderApplicationModule {}
