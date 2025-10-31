import { ProductModule } from '@domain/product/product.module';
import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';

@Module({
  imports: [ProductModule],
  controllers: [ProductController],
})
export class ProductApplicationModule {}
