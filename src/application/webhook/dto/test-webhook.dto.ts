import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { WebhookEventType } from './webhook-payload.dto';

export class TestWebhookDto {
  @ApiProperty({
    description: 'Webhook event type to simulate',
    enum: WebhookEventType,
    example: WebhookEventType.PAYMENT_SUCCESS,
  })
  @IsEnum(WebhookEventType)
  @IsNotEmpty()
  event: WebhookEventType;

  @ApiProperty({
    description: 'Transaction ID',
    example: 'tx_123456',
  })
  @IsString()
  @IsNotEmpty()
  transactionId: string;
}
