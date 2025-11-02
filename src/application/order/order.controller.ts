import { OrderService } from '@src/domain/order/services/order.service';
import { Order } from '@domain/order/entities/order.entity';
import { User, UserRole } from '@domain/user/entities/user.entity';
import { CurrentUser } from '@infra/auth/decorators/current-user.decorator';
import { Roles } from '@infra/auth/decorators/roles.decorator';
import { Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('customer - orders')
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

  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  @ApiTags('admin - orders')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all orders',
    description: 'Returns all orders in the system. Only accessible by ADMIN users. Use nested=false to improve performance by excluding nested objects.',
  })
  @ApiQuery({
    name: 'nested',
    required: false,
    type: Boolean,
    description: 'If true (default), returns orders with nested objects (customer, cart, transactions). If false, returns only basic order data.',
    example: true,
    schema: {
      type: 'boolean',
      default: true,
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
    type: [Order],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - ADMIN role required',
  })
  async listAllOrders(@Query('nested') nested?: string): Promise<Order[]> {
    const includeNested = nested !== 'false';
    return await this.orderService.findAll(includeNested);
  }

  @Get('admin/:id')
  @Roles(UserRole.ADMIN)
  @ApiTags('admin - orders')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get order by ID',
    description: 'Returns a specific order by ID. Only accessible by ADMIN users.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({
    status: 200,
    description: 'Order retrieved successfully',
    type: Order,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - ADMIN role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  async getOrderById(@Param('id') id: string): Promise<Order> {
    return await this.orderService.findOneOrFail(id);
  }
}
