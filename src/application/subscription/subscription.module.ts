import { SubscriptionModule } from '@domain/subscription/subscription.module';
import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';

@Module({
  imports: [SubscriptionModule],
  controllers: [SubscriptionController],
})
export class SubscriptionApplicationModule {}
