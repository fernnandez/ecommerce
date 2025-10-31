import { Injectable, Logger } from '@nestjs/common';
import {
  ChargeRequest,
  ChargeResponse,
  ChargeStatus,
  IChargeProvider,
  PaymentMethod,
} from '../interfaces/charge-provider.interface';

@Injectable()
export class AdyenProvider implements IChargeProvider {
  private readonly logger = new Logger(AdyenProvider.name);

  async charge(request: ChargeRequest): Promise<ChargeResponse> {
    this.logger.log(`Processing charge via Adyen: ${request.reference}`);

    await this.simulateNetworkDelay();

    const transactionId = this.generateTransactionId();
    const chargeStatus = this.getChargeStatus(request.paymentMethod);

    const response: ChargeResponse = {
      success: chargeStatus !== ChargeStatus.REFUSED && chargeStatus !== ChargeStatus.FAILED,
      transactionId,
      status: chargeStatus,
      message: this.getStatusMessage(chargeStatus),
    };

    if (response.success) {
      this.logger.log(`Charge ${chargeStatus}: ${transactionId}`);
    } else {
      this.logger.warn(`Charge ${chargeStatus}: ${transactionId}`);
    }

    return response;
  }

  private getChargeStatus(paymentMethod: PaymentMethod): ChargeStatus {
    if (paymentMethod === PaymentMethod.PIX || paymentMethod === PaymentMethod.SLIPBANK) {
      return ChargeStatus.CREATED;
    }

    if (paymentMethod === PaymentMethod.CARD) {
      const random = Math.random();
      if (random < 0.6) {
        // 60% - pagamento aprovado
        return ChargeStatus.PAID;
      } else if (random < 0.8) {
        // 20% - recusado
        return ChargeStatus.REFUSED;
      } else {
        // 20% - processando
        return ChargeStatus.PROCESSING;
      }
    }

    // Fallback
    return ChargeStatus.FAILED;
  }

  private getStatusMessage(status: ChargeStatus): string {
    const messages = {
      [ChargeStatus.CREATED]: 'Charge created, awaiting payment',
      [ChargeStatus.PAID]: 'Payment processed successfully',
      [ChargeStatus.REFUSED]: 'Payment was refused by the payment provider',
      [ChargeStatus.PROCESSING]: 'Payment is being processed',
      [ChargeStatus.FAILED]: 'Payment failed',
    };

    return messages[status] || 'Unknown status';
  }

  private async simulateNetworkDelay(): Promise<void> {
    const delay = Math.floor(Math.random() * 400) + 100; //(100-500ms)
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  private generateTransactionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `PSP_${timestamp}_${random}`.toUpperCase();
  }
}
