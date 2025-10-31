export enum ChargeStatus {
  CREATED = 'created',
  FAILED = 'failed',
  PAID = 'paid',
  REFUSED = 'refused',
  PROCESSING = 'processing',
}

export enum PaymentMethod {
  CARD = 'card',
  SLIPBANK = 'slipbank',
  PIX = 'pix',
}

export interface ChargeRequest {
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  reference: string;
  customerEmail?: string;
  customerName?: string;
}

export interface ChargeResponse {
  success: boolean;
  transactionId: string;
  status: ChargeStatus;
  message?: string;
}

export const CHARGE_PROVIDER_TOKEN = 'CHARGE_PROVIDER';

export interface IChargeProvider {
  charge(request: ChargeRequest): Promise<ChargeResponse>;
}

