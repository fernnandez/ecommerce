import { SubscriptionService } from '@src/domain/subscription/services/subscription.service';
import { Subscription } from '@domain/subscription/entities/subscription.entity';
import { User } from '@domain/user/entities/user.entity';
import { CurrentUser } from '@infra/auth/decorators/current-user.decorator';
import { Controller, Get, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('subscription')
@ApiBearerAuth('JWT-auth')
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
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
}
