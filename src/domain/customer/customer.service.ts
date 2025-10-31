import { Customer } from '@domain/customer/entities/customer.entity';
import { Identification } from '@domain/customer/value-objects/identification.vo';
import { UserRole } from '@domain/user/entities/user.entity';
import { UserService } from '@domain/user/user.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly userService: UserService,
  ) {}

  @Transactional()
  async create(createCustomerDto: {
    name: string;
    email: string;
    password: string;
    phone: string;
    identificationNumber: string;
  }): Promise<Customer> {
    let identification: Identification;
    try {
      identification = new Identification(createCustomerDto.identificationNumber);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid identification number',
      );
    }

    const existingCustomer = await this.customerRepository.findOne({
      where: {
        identificationNumber: identification.getValue() as any,
      },
    });

    if (existingCustomer) {
      throw new ConflictException('Identification number already in use');
    }

    const user = await this.userService.create({
      name: createCustomerDto.name,
      email: createCustomerDto.email,
      password: createCustomerDto.password,
      role: UserRole.ADMIN,
    });

    const customer = this.customerRepository.create({
      phone: createCustomerDto.phone,
      identificationNumber: identification,
      user: user,
    });

    return await this.customerRepository.save(customer);
  }

  async findOneOrFail(id: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }
}
