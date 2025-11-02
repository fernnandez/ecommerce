import { CartResponseDto, CartService, CheckoutResponseDto } from '@src/domain/cart/services/cart.service';
import { User } from '@domain/user/entities/user.entity';
import { CurrentUser } from '@infra/auth/decorators/current-user.decorator';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AddItemDto } from './dto/add-item.dto';
import { CartResponse } from './dto/cart-response.dto';
import { CheckoutResponseDto as CheckoutResponseDtoType } from './dto/checkout-response.dto';
import { CheckoutDto } from './dto/checkout.dto';

@ApiTags('customer - cart')
@ApiBearerAuth('JWT-auth')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post('open')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Open a new cart',
    description: 'Opens a new cart for the authenticated customer. Returns existing open cart if one already exists.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cart opened or retrieved successfully',
    type: CartResponse,
  })
  async openCart(@CurrentUser() user: User): Promise<CartResponseDto> {
    if (!user.customer) {
      throw new NotFoundException('Customer not found for user');
    }
    return await this.cartService.openCart(user.customer.id);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get open cart',
    description: 'Returns the current open cart for the authenticated customer',
  })
  @ApiResponse({
    status: 200,
    description: 'Cart retrieved successfully',
    type: CartResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'No open cart found',
  })
  async getCart(@CurrentUser() user: User): Promise<CartResponseDto> {
    if (!user.customer) {
      throw new NotFoundException('Customer not found for user');
    }
    const cart = await this.cartService.getOpenCart(user.customer.id);
    if (!cart) {
      throw new NotFoundException('No open cart found');
    }
    return cart;
  }

  @Post('items')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add item to cart',
    description:
      'Adds a product to the cart. Creates cart if it does not exist. If product already exists, increases the quantity.',
  })
  @ApiBody({ type: AddItemDto })
  @ApiResponse({
    status: 200,
    description: 'Item added successfully',
    type: CartResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
  })
  async addItem(@CurrentUser() user: User, @Body() addItemDto: AddItemDto): Promise<CartResponseDto> {
    if (!user.customer) {
      throw new NotFoundException('Customer not found for user');
    }
    return await this.cartService.addItem(user.customer.id, addItemDto.productId, addItemDto.quantity || 1);
  }

  @Delete('items/:itemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove item from cart',
    description: 'Removes an item from the cart',
  })
  @ApiParam({ name: 'itemId', description: 'Cart item UUID' })
  @ApiResponse({
    status: 200,
    description: 'Item removed successfully',
    type: CartResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Cart or item not found',
  })
  async removeItem(@CurrentUser() user: User, @Param('itemId') itemId: string): Promise<CartResponseDto> {
    if (!user.customer) {
      throw new NotFoundException('Customer not found for user');
    }
    return await this.cartService.removeItem(user.customer.id, itemId);
  }

  @Post(':id/checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Checkout cart',
    description: 'Finalizes the cart and creates an order. Allows retry if previous attempt failed.',
  })
  @ApiParam({ name: 'id', description: 'Cart UUID' })
  @ApiBody({ type: CheckoutDto })
  @ApiResponse({
    status: 200,
    description: 'Checkout completed successfully',
    type: CheckoutResponseDtoType,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Cart cannot be closed without items or with zero total',
  })
  @ApiResponse({
    status: 404,
    description: 'Cart not found or does not belong to customer',
  })
  async checkout(
    @CurrentUser() user: User,
    @Param('id') cartId: string,
    @Body() checkoutDto: CheckoutDto,
  ): Promise<CheckoutResponseDto> {
    if (!user.customer) {
      throw new NotFoundException('Customer not found for user');
    }
    return await this.cartService.checkout(cartId, user.customer.id, checkoutDto.paymentMethod);
  }
}
