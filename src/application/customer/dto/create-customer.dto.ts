import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({
    description: 'Customer full name',
    example: 'Angelo Fernandes',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Customer email address',
    example: 'angelo.fernandes@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'password123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'Customer phone number',
    example: '11999999999',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: 'Customer CPF (Brazilian identification number)',
    example: '93423283009',
  })
  @IsString()
  @IsNotEmpty()
  identificationNumber: string;
}
