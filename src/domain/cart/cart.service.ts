import { Cart, CartStatus } from '@domain/cart/entities/cart.entity';
import { CartItem } from '@domain/cart/entities/cart-item.entity';
import { CustomerService } from '@domain/customer/customer.service';
import { ProductService } from '@domain/product/product.service';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export interface CartResponseDto {
  id: string;
  status: CartStatus;
  total: number;
  items: CartItemResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItemResponseDto {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    private readonly customerService: CustomerService,
    private readonly productService: ProductService,
  ) {}

  async openCart(customerId: string): Promise<CartResponseDto> {
    const existingOpenCart = await this.cartRepository.findOne({
      where: {
        customer: { id: customerId },
        status: CartStatus.OPEN,
        deletedAt: null,
      },
      relations: ['items', 'items.product'],
    });

    if (existingOpenCart) {
      return this.mapCartToResponse(existingOpenCart);
    }

    const customer = await this.customerService.findOneOrFail(customerId);

    const cart = this.cartRepository.create({
      customer,
      status: CartStatus.OPEN,
      total: 0,
    });

    const savedCart = await this.cartRepository.save(cart);

    const cartWithRelations = await this.cartRepository.findOne({
      where: { id: savedCart.id },
      relations: ['items', 'items.product'],
    });

    return this.mapCartToResponse(cartWithRelations);
  }

  async getOpenCart(customerId: string): Promise<CartResponseDto | null> {
    const cart = await this.cartRepository.findOne({
      where: {
        customer: { id: customerId },
        status: CartStatus.OPEN,
        deletedAt: null,
      },
      relations: ['items', 'items.product'],
    });

    if (!cart) {
      return null;
    }

    return this.mapCartToResponse(cart);
  }

  private async getOrCreateOpenCartEntity(customerId: string): Promise<Cart> {
    const cart = await this.cartRepository.findOne({
      where: {
        customer: { id: customerId },
        status: CartStatus.OPEN,
        deletedAt: null,
      },
      relations: ['items', 'items.product'],
    });

    if (cart) {
      return cart;
    }

    const customer = await this.customerService.findOneOrFail(customerId);

    const newCart = this.cartRepository.create({
      customer,
      status: CartStatus.OPEN,
      total: 0,
    });

    const savedCart = await this.cartRepository.save(newCart);

    return await this.cartRepository.findOne({
      where: { id: savedCart.id },
      relations: ['items', 'items.product'],
    });
  }

  async addItem(customerId: string, productId: string, quantity: number = 1): Promise<CartResponseDto> {
    const cart = await this.getOrCreateOpenCartEntity(customerId);

    const product = await this.productService.findOneOrFail(productId);

    const existingItem = await this.cartItemRepository.findOne({
      where: {
        cart: { id: cart.id },
        product: { id: productId },
      },
    });

    if (existingItem) {
      existingItem.quantity += quantity;
      await this.cartItemRepository.save(existingItem);
    } else {
      const cartItem = this.cartItemRepository.create({
        cart,
        product,
        quantity,
        price: product.price,
      });
      await this.cartItemRepository.save(cartItem);
    }

    await this.updateCartTotal(cart.id);

    const cartWithRelations = await this.cartRepository.findOne({
      where: { id: cart.id },
      relations: ['items', 'items.product'],
    });

    return this.mapCartToResponse(cartWithRelations);
  }

  async removeItem(customerId: string, itemId: string): Promise<CartResponseDto> {
    const cart = await this.cartRepository.findOne({
      where: {
        customer: { id: customerId },
        status: CartStatus.OPEN,
        deletedAt: null,
      },
      relations: ['items', 'items.product'],
    });

    if (!cart) {
      throw new NotFoundException('Open cart not found');
    }

    const item = await this.cartItemRepository.findOne({
      where: { id: itemId, cart: { id: cart.id } },
    });

    if (!item) {
      throw new NotFoundException('Item not found in cart');
    }

    await this.cartItemRepository.remove(item);

    await this.updateCartTotal(cart.id);

    const cartWithRelations = await this.cartRepository.findOne({
      where: { id: cart.id },
      relations: ['items', 'items.product'],
    });

    return this.mapCartToResponse(cartWithRelations);
  }

  async closeCart(cartId: string): Promise<CartResponseDto> {
    const cart = await this.cartRepository.findOne({
      where: { id: cartId },
      relations: ['items', 'items.product'],
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestException('Cannot close a cart without items');
    }

    if (Number(cart.total) <= 0) {
      throw new BadRequestException('Cannot close a cart with zero or negative total');
    }

    cart.status = CartStatus.CLOSED;
    await this.cartRepository.save(cart);

    // TODO: Implementar checkout do carrinho

    const cartWithRelations = await this.cartRepository.findOne({
      where: { id: cart.id },
      relations: ['items', 'items.product'],
    });

    return this.mapCartToResponse(cartWithRelations);
  }

  private async updateCartTotal(cartId: string): Promise<void> {
    const items = await this.cartItemRepository.find({
      where: { cart: { id: cartId } },
    });

    const total = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

    await this.cartRepository.update(cartId, { total });
  }

  private mapCartToResponse(cart: Cart): CartResponseDto {
    return {
      id: cart.id,
      status: cart.status,
      total: Number(cart.total),
      items: cart.items?.map(item => this.mapCartItemToResponse(item)) || [],
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }

  private mapCartItemToResponse(item: CartItem): CartItemResponseDto {
    return {
      id: item.id,
      productId: item.product?.id || '',
      productName: item.product?.name || '',
      quantity: item.quantity,
      price: Number(item.price),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}

