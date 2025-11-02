import { Subscription } from '@domain/subscription/entities/subscription.entity';
import { User, UserRole } from '@domain/user/entities/user.entity';
import { CurrentUser } from '@infra/auth/decorators/current-user.decorator';
import { Roles } from '@infra/auth/decorators/roles.decorator';
import { Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RecurringBillingService } from '@src/domain/subscription/services/recurring-billing.service';
import { SubscriptionService } from '@src/domain/subscription/services/subscription.service';
import { ProcessBillingResponseDto } from './dto/process-billing-response.dto';

@ApiBearerAuth('JWT-auth')
@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly recurringBillingService: RecurringBillingService,
  ) {}

  @Get()
  @ApiTags('customer - subscriptions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List customer subscriptions',
    description: 'Returns all subscriptions for the authenticated customer',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscriptions retrieved successfully',
    type: [Subscription],
  })
  async listSubscriptions(@CurrentUser() user: User): Promise<Subscription[]> {
    if (!user.customer) {
      throw new NotFoundException('Customer not found for user');
    }
    return await this.subscriptionService.findByCustomer(user.customer.id);
  }

  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  @ApiTags('admin - subscriptions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all subscriptions',
    description: 'Returns all subscriptions in the system. Only accessible by ADMIN users. Use nested=false to improve performance by excluding nested objects.',
  })
  @ApiQuery({
    name: 'nested',
    required: false,
    type: Boolean,
    description: 'If true (default), returns subscriptions with nested objects (customer, product, periods, periods.order). If false, returns only basic subscription data.',
    example: true,
    schema: {
      type: 'boolean',
      default: true,
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Subscriptions retrieved successfully',
    type: [Subscription],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - ADMIN role required',
  })
  async listAllSubscriptions(@Query('nested') nested?: string): Promise<Subscription[]> {
    const includeNested = nested !== 'false';
    return await this.subscriptionService.findAll(includeNested);
  }

  @Get('admin/:id')
  @Roles(UserRole.ADMIN)
  @ApiTags('admin - subscriptions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get subscription by ID',
    description: 'Returns a specific subscription by ID. Only accessible by ADMIN users.',
  })
  @ApiParam({ name: 'id', description: 'Subscription UUID' })
  @ApiResponse({
    status: 200,
    description: 'Subscription retrieved successfully',
    type: Subscription,
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
    description: 'Subscription not found',
  })
  async getSubscriptionById(@Param('id') id: string): Promise<Subscription> {
    return await this.subscriptionService.findOneOrFail(id);
  }

  @Post('process-billing')
  @Roles(UserRole.ADMIN)
  @ApiTags('admin - subscriptions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process due subscriptions billing',
    description:
      'Forces billing processing for all subscriptions with due nextBillingDate. Only accessible by ADMIN users. This is the manual trigger for the recurring billing engine.',
  })
  @ApiResponse({
    status: 200,
    description: 'Billing process completed successfully',
    type: ProcessBillingResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - ADMIN role required',
  })
  async processBilling(): Promise<ProcessBillingResponseDto> {
    const results = await this.recurringBillingService.processDueSubscriptions();

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      processed: results.length,
      successful,
      failed,
      results,
    };
  }
}
