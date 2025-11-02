import { BillingResult } from '@src/domain/subscription/services/recurring-billing.service';
import { ApiProperty } from '@nestjs/swagger';

export class BillingResultDto {
  @ApiProperty({ description: 'Subscription ID', example: 'uuid' })
  subscriptionId: string;

  @ApiProperty({ description: 'Whether the billing was successful', example: true })
  success: boolean;

  @ApiProperty({ description: 'Order ID created for this billing', example: 'uuid', required: false })
  orderId?: string;

  @ApiProperty({ description: 'Transaction ID created for this billing', example: 'tx_123456', required: false })
  transactionId?: string;

  @ApiProperty({ description: 'Error message if billing failed', example: 'Payment failed', required: false })
  error?: string;
}

export class ProcessBillingResponseDto {
  @ApiProperty({ description: 'Total number of subscriptions processed', example: 5 })
  processed: number;

  @ApiProperty({ description: 'Number of successful billings', example: 4 })
  successful: number;

  @ApiProperty({ description: 'Number of failed billings', example: 1 })
  failed: number;

  @ApiProperty({
    description: 'Detailed results for each subscription processed',
    type: [BillingResultDto],
  })
  results: BillingResult[];
}
