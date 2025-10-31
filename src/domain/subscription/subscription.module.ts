import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionPeriod } from './entities/subscription-period.entity';
import { SubscriptionService } from './subscription.service';
import { RecurringBillingService } from './services/recurring-billing.service';
import { RecurringBillingSchedulerService } from './services/recurring-billing-scheduler.service';
import { OrderModule } from '@domain/order/order.module';
import { IntegrationModule } from '@integration/integration.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, SubscriptionPeriod]),
    forwardRef(() => OrderModule),
    IntegrationModule,
  ],
  providers: [SubscriptionService, RecurringBillingService, RecurringBillingSchedulerService],
  exports: [SubscriptionService, RecurringBillingService],
})
export class SubscriptionModule {}

