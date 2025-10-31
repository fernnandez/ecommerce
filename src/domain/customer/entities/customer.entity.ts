import { IdentificationTransformer } from '@domain/customer/value-objects/identification.transformer';
import { Identification } from '@domain/customer/value-objects/identification.vo';
import { User } from '@domain/user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('customer')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  phone: string;

  @Column({
    type: 'varchar',
    unique: true,
    name: 'identification_number',
    transformer: new IdentificationTransformer(),
  })
  identificationNumber: Identification;

  @OneToOne(() => User, user => user.customer, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
