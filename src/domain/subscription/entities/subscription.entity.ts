import { Customer } from '@domain/customer/entities/customer.entity';
import { Product } from '@domain/product/entities/product.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SubscriptionPeriod } from './subscription-period.entity';

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
}

export enum Periodicity {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

@Entity('subscription')
@Index(['customer'])
@Index(['status'])
@Index(['customer', 'status'])
@Index(['nextBillingDate'])
@Index(['status', 'nextBillingDate'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'subscription_id', unique: true })
  subscriptionId: string;

  @ManyToOne(() => Customer, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({
    type: 'enum',
    enum: Periodicity,
  })
  periodicity: Periodicity;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.PENDING,
  })
  status: SubscriptionStatus;

  @Column({ name: 'next_billing_date', type: 'date' })
  nextBillingDate: Date;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string;

  @OneToMany(() => SubscriptionPeriod, period => period.subscription, { cascade: true })
  periods: SubscriptionPeriod[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
