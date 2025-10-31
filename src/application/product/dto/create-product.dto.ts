import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export enum ProductType {
  SINGLE = 'single',
  SUBSCRIPTION = 'subscription',
}

export class CreateProductDto {
  @ApiProperty({
    description: 'Product name',
    example: 'CDB Course',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Product type',
    enum: ProductType,
    example: ProductType.SINGLE,
  })
  @IsEnum(ProductType)
  @IsNotEmpty()
  type: ProductType;

  @ApiProperty({
    description: 'Product price',
    example: 99.99,
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;
}

