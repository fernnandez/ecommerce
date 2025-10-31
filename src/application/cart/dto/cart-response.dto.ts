import { ApiProperty } from '@nestjs/swagger';
import { CartStatus } from '@domain/cart/entities/cart.entity';

export class CartItemResponse {
  @ApiProperty({ description: 'Cart item ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Product ID', example: 'uuid' })
  productId: string;

  @ApiProperty({ description: 'Product name', example: 'CDB Course' })
  productName: string;

  @ApiProperty({ description: 'Quantity', example: 2 })
  quantity: number;

  @ApiProperty({ description: 'Item price at the time it was added', example: 99.99 })
  price: number;

  @ApiProperty({ description: 'Item creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Item last update date' })
  updatedAt: Date;
}

export class CartResponse {
  @ApiProperty({ description: 'Cart ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Cart status', enum: CartStatus, example: CartStatus.OPEN })
  status: CartStatus;

  @ApiProperty({ description: 'Cart total', example: 199.98 })
  total: number;

  @ApiProperty({ description: 'Cart items', type: [CartItemResponse] })
  items: CartItemResponse[];

  @ApiProperty({ description: 'Cart creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Cart last update date' })
  updatedAt: Date;
}

