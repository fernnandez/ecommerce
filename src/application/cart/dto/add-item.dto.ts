import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';

export class AddItemDto {
  @ApiProperty({
    description: 'Product ID to add to cart',
    example: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    description: 'Quantity of the product',
    example: 1,
    minimum: 1,
    required: false,
    default: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;
}

