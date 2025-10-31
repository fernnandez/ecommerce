import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Public } from '@infra/decorator/public.decorator';
import { CustomerService } from '@domain/customer/customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { Customer } from '@domain/customer/entities/customer.entity';

@ApiTags('customer')
@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post('create')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new customer',
    description: 'Creates a new customer with associated user account',
  })
  @ApiBody({ type: CreateCustomerDto })
  @ApiResponse({
    status: 201,
    description: 'Customer created successfully',
    type: Customer,
  })
  @ApiResponse({
    status: 409,
    description: 'Email or CPF already in use',
  })
  async create(
    @Body() createCustomerDto: CreateCustomerDto,
  ): Promise<Customer> {
    return await this.customerService.create(createCustomerDto);
  }
}
