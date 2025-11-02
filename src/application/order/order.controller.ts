import { OrderService } from '@src/domain/order/services/order.service';
import { Order } from '@domain/order/entities/order.entity';
import { User } from '@domain/user/entities/user.entity';
import { CurrentUser } from '@infra/auth/decorators/current-user.decorator';
import { Controller, Get, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('order')
@ApiBearerAuth('JWT-auth')
@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List customer orders',
    description: 'Returns all orders for the authenticated customer',
  })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
    type: [Order],
  })
  async listOrders(@CurrentUser() user: User): Promise<Order[]> {
    if (!user.customer) {
      throw new NotFoundException('Customer not found for user');
    }
    return await this.orderService.findByCustomer(user.customer.id);
  }
}
