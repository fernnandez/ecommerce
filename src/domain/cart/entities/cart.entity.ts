import { Customer } from '@domain/customer/entities/customer.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CartItem } from './cart-item.entity';

export enum CartStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

@Entity('cart')
export class Cart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Customer, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({
    type: 'enum',
    enum: CartStatus,
    default: CartStatus.OPEN,
  })
  status: CartStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total: number;

  @OneToMany(() => CartItem, cartItem => cartItem.cart, { cascade: true })
  items: CartItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}

