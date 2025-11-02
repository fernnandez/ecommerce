import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum WebhookEventType {
  PAYMENT_SUCCESS = 'payment_success',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_PENDING = 'payment_pending',
}

class WebhookMetadataDto {

  @ApiProperty({ description: 'Subscription ID (optional)', example: 'uuid', required: false })
  @IsUUID()
  @IsOptional()
  subscriptionId?: string;
}

export class WebhookPayloadDto {
  @ApiProperty({
    description: 'Webhook event type',
    enum: WebhookEventType,
    example: WebhookEventType.PAYMENT_SUCCESS,
  })
  @IsEnum(WebhookEventType)
  @IsNotEmpty()
  event: WebhookEventType;

  @ApiProperty({ description: 'Transaction ID', example: 'tx_123456' })
  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @ApiProperty({ description: 'Order ID', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ description: 'Customer ID', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ description: 'Amount', example: 150.0 })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ description: 'Currency', example: 'BRL' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({ description: 'Payment method', example: 'card' })
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @ApiProperty({ description: 'Timestamp', example: '2025-10-09T15:00:00Z' })
  @IsString()
  @IsNotEmpty()
  timestamp: string;

  @ApiProperty({ description: 'Metadata', type: WebhookMetadataDto, required: false })
  @IsObject()
  @ValidateNested()
  @Type(() => WebhookMetadataDto)
  @IsOptional()
  metadata?: WebhookMetadataDto;
}

