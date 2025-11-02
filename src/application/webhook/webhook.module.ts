import { OrderModule } from '@domain/order/order.module';
import { Order } from '@domain/order/entities/order.entity';
import { Transaction } from '@domain/order/entities/transaction.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookController } from './webhook.controller';
import { WebhookTestController } from './webhook-test.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [OrderModule, TypeOrmModule.forFeature([Order, Transaction])],
  controllers: [WebhookController, WebhookTestController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}
