import { ApiProperty } from '@nestjs/swagger';

export class CheckoutResponseDto {
  @ApiProperty({ description: 'Order ID', example: 'uuid' })
  orderId: string;
}

