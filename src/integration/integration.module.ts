import { Module } from '@nestjs/common';
import { ChargeModule } from './charge/charge.module';

@Module({
  imports: [ChargeModule],
  exports: [ChargeModule],
})
export class IntegrationModule {}

