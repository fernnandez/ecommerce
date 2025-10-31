import { Module } from '@nestjs/common';
import { AdyenProvider } from './providers/adyen.provider';
import { CHARGE_PROVIDER_TOKEN } from './interfaces/charge-provider.interface';

@Module({
  providers: [
    {
      provide: CHARGE_PROVIDER_TOKEN,
      useClass: AdyenProvider,
    },
  ],
  exports: [CHARGE_PROVIDER_TOKEN],
})
export class ChargeModule {}

