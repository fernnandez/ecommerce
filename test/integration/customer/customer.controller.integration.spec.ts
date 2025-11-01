import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { initializeTransactionalContext, StorageDriver } from 'typeorm-transactional';
import { AppModule } from '@src/app.module';
import { Customer } from '@src/domain/customer/entities/customer.entity';
import { User } from '@src/domain/user/entities/user.entity';
import { createTestingApp } from '@test/helper/create-testing-app';
import { runWithRollbackTransaction } from '@test/helper/database/test-transaction';
import { FixtureHelper } from '@test/helper/fixture-helper';

initializeTransactionalContext({ storageDriver: StorageDriver.AUTO });

describe('CustomerController - Integration (HTTP)', () => {
  let app: INestApplication;
  let fixtures: FixtureHelper;
  let customerRepo: Repository<Customer>;
  let userRepo: Repository<User>;

  const baseUrl = '/customer';

  beforeAll(async () => {
    app = await createTestingApp({
      imports: [AppModule],
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    fixtures = new FixtureHelper(app);
    customerRepo = app.get<Repository<Customer>>(getRepositoryToken(Customer));
    userRepo = app.get<Repository<User>>(getRepositoryToken(User));
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  describe('POST /customer/create', () => {
    it(
      'should create a new customer successfully',
      runWithRollbackTransaction(async () => {
        const createCustomerDto = {
          name: 'New Customer',
          email: `new.customer.${Date.now()}@example.com`, // Unique email
          password: 'password123',
          phone: '+5511999999999',
          identificationNumber: '77760573391', // Valid CPF not in fixtures
        };

        const response = await request(app.getHttpServer())
          .post(`${baseUrl}/create`)
          .send(createCustomerDto)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.phone).toBe(createCustomerDto.phone);
        expect(response.body.user).toBeDefined();
        expect(response.body.user.email).toBe(createCustomerDto.email);
        expect(response.body.user.name).toBe(createCustomerDto.name);

        const savedCustomer = await customerRepo.findOne({
          where: { id: response.body.id },
          relations: ['user'],
        });

        expect(savedCustomer).toBeDefined();
        expect(savedCustomer?.phone).toBe(createCustomerDto.phone);
        expect(savedCustomer?.user.email).toBe(createCustomerDto.email);
      }),
    );

    it(
      'should return 409 when email already exists',
      runWithRollbackTransaction(async () => {
        const existingUser = await fixtures.fixtures.users.john();

        const createCustomerDto = {
          name: 'New Customer',
          email: existingUser.email, // Use existing email from fixtures
          password: 'password123',
          phone: '+5511555555555',
          identificationNumber: '28130421100', // Valid CPF not in fixtures - will conflict on email only
        };

        await request(app.getHttpServer())
          .post(`${baseUrl}/create`)
          .send(createCustomerDto)
          .expect(409);
      }),
    );

    it(
      'should return 409 when identification number already exists',
      runWithRollbackTransaction(async () => {
        const existingCustomer = await fixtures.fixtures.customers.john();
        // Get the identification number value from the fixture
        const existingIdentification = existingCustomer.identificationNumber.getValue() as string;

        const createCustomerDto = {
          name: 'New Customer',
          email: `new.customer.${Date.now()}@example.com`, // Unique email
          password: 'password123',
          phone: '+5511555555555',
          identificationNumber: existingIdentification,
        };

        await request(app.getHttpServer())
          .post(`${baseUrl}/create`)
          .send(createCustomerDto)
          .expect(409);
      }),
    );

    it(
      'should return 400 when name is missing',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer())
          .post(`${baseUrl}/create`)
          .send({
            email: 'john.doe@example.com',
            password: 'password123',
            phone: '+5511999999999',
            identificationNumber: '12345678909',
          })
          .expect(400);
      }),
    );

    it(
      'should return 400 when email is missing',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer())
          .post(`${baseUrl}/create`)
          .send({
            name: 'John Doe',
            password: 'password123',
            phone: '+5511999999999',
            identificationNumber: '12345678909',
          })
          .expect(400);
      }),
    );

    it(
      'should return 400 when email is invalid',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer())
          .post(`${baseUrl}/create`)
          .send({
            name: 'John Doe',
            email: 'invalid-email',
            password: 'password123',
            phone: '+5511999999999',
            identificationNumber: '12345678909',
          })
          .expect(400);
      }),
    );

    it(
      'should return 400 when password is missing',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer())
          .post(`${baseUrl}/create`)
          .send({
            name: 'John Doe',
            email: 'john.doe@example.com',
            phone: '+5511999999999',
            identificationNumber: '12345678909',
          })
          .expect(400);
      }),
    );

    it(
      'should return 400 when password is too short',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer())
          .post(`${baseUrl}/create`)
          .send({
            name: 'John Doe',
            email: 'john.doe@example.com',
            password: '12345',
            phone: '+5511999999999',
            identificationNumber: '12345678909',
          })
          .expect(400);
      }),
    );

    it(
      'should return 400 when phone is missing',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer())
          .post(`${baseUrl}/create`)
          .send({
            name: 'John Doe',
            email: 'john.doe@example.com',
            password: 'password123',
            identificationNumber: '12345678909',
          })
          .expect(400);
      }),
    );

    it(
      'should return 400 when identification number is missing',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer())
          .post(`${baseUrl}/create`)
          .send({
            name: 'John Doe',
            email: 'john.doe@example.com',
            password: 'password123',
            phone: '+5511999999999',
          })
          .expect(400);
      }),
    );

    it(
      'should return 400 when identification number is invalid CPF',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer())
          .post(`${baseUrl}/create`)
          .send({
            name: 'John Doe',
            email: 'john.doe@example.com',
            password: 'password123',
            phone: '+5511999999999',
            identificationNumber: '11111111111',
          })
          .expect(400);
      }),
    );

    it(
      'should create user along with customer',
      runWithRollbackTransaction(async () => {
        const createCustomerDto = {
          name: 'Jane Doe',
          email: `jane.doe.${Date.now()}@example.com`, // Unique email to avoid conflicts
          password: 'password123',
          phone: '+5511888888888',
          identificationNumber: '28130421100', // Valid CPF not in fixtures - unique email allows creation
        };

        const response = await request(app.getHttpServer())
          .post(`${baseUrl}/create`)
          .send(createCustomerDto)
          .expect(201);

        const savedUser = await userRepo.findOne({
          where: { id: response.body.user.id },
        });

        expect(savedUser).toBeDefined();
        expect(savedUser?.email).toBe(createCustomerDto.email);
        expect(savedUser?.name).toBe(createCustomerDto.name);
      }),
    );
  });
});
