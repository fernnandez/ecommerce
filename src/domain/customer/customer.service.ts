import { Customer } from '@domain/customer/entities/customer.entity';
import { Identification } from '@domain/customer/value-objects/identification.vo';
import { UserRole } from '@domain/user/entities/user.entity';
import { UserService } from '@domain/user/user.service';
import { ConflictException, Injectable } from '@nestjs/common';
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
    const identification = new Identification(createCustomerDto.identificationNumber);

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
      role: UserRole.CUSTOMER,
    });

    const customer = this.customerRepository.create({
      phone: createCustomerDto.phone,
      identificationNumber: identification,
      user: user,
    });

    return await this.customerRepository.save(customer);
  }
}
