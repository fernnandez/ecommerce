import { CustomerModule } from '@domain/customer/customer.module';
import { ProductModule } from '@domain/product/product.module';
import { OrderModule } from '@domain/order/order.module';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { CartService } from './services/cart.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cart, CartItem]),
    CustomerModule,
    ProductModule,
    forwardRef(() => OrderModule),
  ],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}

