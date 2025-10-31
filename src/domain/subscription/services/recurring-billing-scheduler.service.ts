import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecurringBillingService } from './recurring-billing.service';

@Injectable()
export class RecurringBillingSchedulerService {
  private readonly logger = new Logger(RecurringBillingSchedulerService.name);

  constructor(private readonly recurringBillingService: RecurringBillingService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'recurring-billing',
    timeZone: 'America/Sao_Paulo',
  })
  async handleRecurringBilling() {
    this.logger.log('Starting scheduled recurring billing process');
    try {
      const results = await this.recurringBillingService.processDueSubscriptions();
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      this.logger.log(
        `Recurring billing completed. Processed: ${results.length}, Successful: ${successful}, Failed: ${failed}`,
      );
    } catch (error) {
      this.logger.error(`Error in scheduled recurring billing: ${error.message}`);
    }
  }
}
