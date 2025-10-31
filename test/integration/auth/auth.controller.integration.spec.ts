import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { Repository } from 'typeorm';
import {
  initializeTransactionalContext,
  StorageDriver,
} from 'typeorm-transactional';
import { AppModule } from '@src/app.module';
import { User, UserRole } from '@src/domain/user/entities/user.entity';
import { createTestingApp } from '@test/helper/create-testing-app';
import { runWithRollbackTransaction } from '@test/helper/database/test-transaction';

initializeTransactionalContext({ storageDriver: StorageDriver.AUTO });

describe('AuthController - Integration (HTTP)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;

  const baseUrl = '/auth';

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

    userRepo = app.get<Repository<User>>(getRepositoryToken(User));
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  describe('POST /auth/login', () => {
    it(
      'should login with valid credentials',
      runWithRollbackTransaction(async () => {
        const plainPassword = 'password123';
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        const testUser = {
          name: 'Test User',
          email: 'test@example.com',
          password: hashedPassword,
          role: UserRole.CUSTOMER,
        };

        const savedUser = await userRepo.save(userRepo.create(testUser));

        const response = await request(app.getHttpServer())
          .post(`${baseUrl}/login`)
          .send({
            email: testUser.email,
            password: plainPassword,
          })
          .expect(200);

        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('user');
        expect(response.body.user.id).toBe(savedUser.id);
        expect(response.body.user.email).toBe(testUser.email);
        expect(response.body.user.name).toBe(testUser.name);
        expect(response.body.user.role).toBe(testUser.role);
        expect(typeof response.body.accessToken).toBe('string');
      }),
    );

    it(
      'should return 401 with invalid email',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer())
          .post(`${baseUrl}/login`)
          .send({
            email: 'nonexistent@example.com',
            password: 'password123',
          })
          .expect(401);
      }),
    );

    it(
      'should return 401 with invalid password',
      runWithRollbackTransaction(async () => {
        const plainPassword = 'password123';
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        const testUser = {
          name: 'Test User',
          email: 'test@example.com',
          password: hashedPassword,
          role: UserRole.CUSTOMER,
        };

        await userRepo.save(userRepo.create(testUser));

        await request(app.getHttpServer())
          .post(`${baseUrl}/login`)
          .send({
            email: testUser.email,
            password: 'wrongpassword',
          })
          .expect(401);
      }),
    );

    it(
      'should return 400 with missing email',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer())
          .post(`${baseUrl}/login`)
          .send({
            password: 'password123',
          })
          .expect(400);
      }),
    );

    it(
      'should return 400 with missing password',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer())
          .post(`${baseUrl}/login`)
          .send({
            email: 'test@example.com',
          })
          .expect(400);
      }),
    );

    it(
      'should return 400 with invalid email format',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer())
          .post(`${baseUrl}/login`)
          .send({
            email: 'invalid-email',
            password: 'password123',
          })
          .expect(400);
      }),
    );

    it(
      'should return 401 for deleted user',
      runWithRollbackTransaction(async () => {
        const plainPassword = 'password123';
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        const testUser = {
          name: 'Test User',
          email: 'test@example.com',
          password: hashedPassword,
          role: UserRole.CUSTOMER,
          deletedAt: new Date(),
        };

        await userRepo.save(userRepo.create(testUser));

        await request(app.getHttpServer())
          .post(`${baseUrl}/login`)
          .send({
            email: testUser.email,
            password: plainPassword,
          })
          .expect(401);
      }),
    );
  });

  describe('GET /auth/me', () => {
    it(
      'should return current user profile when authenticated',
      runWithRollbackTransaction(async () => {
        const plainPassword = 'password123';
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        const testUser = {
          name: 'Test User',
          email: 'test@example.com',
          password: hashedPassword,
          role: UserRole.ADMIN,
        };

        const savedUser = await userRepo.save(userRepo.create(testUser));

        const loginRes = await request(app.getHttpServer())
          .post(`${baseUrl}/login`)
          .send({
            email: testUser.email,
            password: plainPassword,
          })
          .expect(200);

        const token = loginRes.body.accessToken;

        const response = await request(app.getHttpServer())
          .get(`${baseUrl}/me`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toBe(savedUser.id);
        expect(response.body.email).toBe(testUser.email);
        expect(response.body.name).toBe(testUser.name);
        expect(response.body.role).toBe(testUser.role);
      }),
    );

    it('should return 401 when token is missing', async () => {
      await request(app.getHttpServer()).get(`${baseUrl}/me`).expect(401);
    });

    it('should return 401 when token is invalid', async () => {
      await request(app.getHttpServer())
        .get(`${baseUrl}/me`)
        .set('Authorization', 'Bearer invalidtoken')
        .expect(401);
    });

    it(
      'should return 401 when user is deleted',
      runWithRollbackTransaction(async () => {
        const plainPassword = 'password123';
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        const testUser = {
          name: 'Test User',
          email: 'test@example.com',
          password: hashedPassword,
          role: UserRole.CUSTOMER,
        };

        const savedUser = await userRepo.save(userRepo.create(testUser));

        const loginRes = await request(app.getHttpServer())
          .post(`${baseUrl}/login`)
          .send({
            email: testUser.email,
            password: plainPassword,
          })
          .expect(200);

        const token = loginRes.body.accessToken;

        await userRepo.update(savedUser.id, { deletedAt: new Date() });

        await request(app.getHttpServer())
          .get(`${baseUrl}/me`)
          .set('Authorization', `Bearer ${token}`)
          .expect(401);
      }),
    );
  });
});
