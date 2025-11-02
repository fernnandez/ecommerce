import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from '@src/app.module';
import { User } from '@src/domain/user/entities/user.entity';
import { createTestingApp } from '@test/helper/create-testing-app';
import { runWithRollbackTransaction } from '@test/helper/database/test-transaction';
import { FixtureHelper } from '@test/helper/fixture-helper';
import request from 'supertest';
import { Repository } from 'typeorm';

describe('AuthController - Integration (HTTP)', () => {
  let app: INestApplication;
  let fixtures: FixtureHelper;
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

    fixtures = new FixtureHelper(app);
    userRepo = app.get<Repository<User>>(getRepositoryToken(User));
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  describe('POST /auth/login', () => {
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
        const user = await fixtures.fixtures.users.john();

        await request(app.getHttpServer())
          .post(`${baseUrl}/login`)
          .send({
            email: user.email,
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
        const user = await fixtures.fixtures.users.mary();
        const plainPassword = 'password123';

        // Delete the user
        await userRepo.update(user.id, { deletedAt: new Date() });

        await request(app.getHttpServer())
          .post(`${baseUrl}/login`)
          .send({
            email: user.email,
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
        const user = await fixtures.fixtures.users.admin();
        const token = await fixtures.fixtures.tokens.admin();

        const response = await request(app.getHttpServer())
          .get(`${baseUrl}/me`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toBe(user.id);
        expect(response.body.email).toBe(user.email);
        expect(response.body.name).toBe(user.name);
        expect(response.body.role).toBe(user.role);
      }),
    );

    it(
      'should return 401 when token is missing',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer()).get(`${baseUrl}/me`).expect(401);
      }),
    );

    it(
      'should return 401 when token is invalid',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer()).get(`${baseUrl}/me`).set('Authorization', 'Bearer invalidtoken').expect(401);
      }),
    );
  });
});
