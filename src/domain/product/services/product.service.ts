import { Product, ProductType } from '@domain/product/entities/product.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(data: { name: string; type: ProductType; price: number }): Promise<Product> {
    const product = this.productRepository.create({
      name: data.name,
      type: data.type,
      price: data.price,
    });

    return await this.productRepository.save(product);
  }

  async findAll(): Promise<Product[]> {
    return await this.productRepository.find({
      where: { deletedAt: null },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneOrFail(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(
    id: string,
    data: {
      name?: string;
      type?: ProductType;
      price?: number;
    },
  ): Promise<Product> {
    const product = await this.findOneOrFail(id);

    Object.assign(product, data);

    return await this.productRepository.save(product);
  }

  async remove(id: string): Promise<void> {
    const _product = await this.findOneOrFail(id);
    await this.productRepository.softDelete(id);
  }
}
