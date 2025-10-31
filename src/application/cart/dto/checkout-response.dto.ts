import { OrderStatus, PaymentMethod } from '@domain/order/entities/order.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CheckoutResponseDto {
  @ApiProperty({ description: 'Order ID', example: 'uuid' })
  orderId: string;

  @ApiProperty({ description: 'Order status', enum: OrderStatus })
  orderStatus: OrderStatus;

  @ApiProperty({ description: 'Order total', example: 100.0 })
  orderTotal: number;

  @ApiProperty({ description: 'Payment method', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @ApiProperty({
    description: 'IDs of subscriptions created (if any)',
    example: ['sub_1234567890_abc', 'sub_1234567891_def'],
    required: false,
    type: [String],
  })
  subscriptionIds?: string[];
}
