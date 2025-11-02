import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '@src/app.module';
import { Product, ProductType } from '@src/domain/product/entities/product.entity';
import { createTestingApp } from '@test/helper/create-testing-app';
import { runWithRollbackTransaction } from '@test/helper/database/test-transaction';
import { FixtureHelper } from '@test/helper/fixture-helper';

describe('ProductController - Integration (HTTP)', () => {
  let app: INestApplication;
  let fixtures: FixtureHelper;
  let productRepo: Repository<Product>;

  const baseUrl = '/product';

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
    productRepo = app.get<Repository<Product>>(getRepositoryToken(Product));
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  describe('POST /product', () => {
    it(
      'should create product successfully and persist in database',
      runWithRollbackTransaction(async () => {
        const adminToken = await fixtures.fixtures.tokens.admin();

        const createProductDto = {
          name: 'Premium Course',
          type: ProductType.SINGLE,
          price: 199.99,
        };

        const response = await request(app.getHttpServer())
          .post(baseUrl)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(createProductDto)
          .expect(201);

        // Assert response structure
        expect(response.body).toMatchObject({
          id: expect.any(String),
          name: createProductDto.name,
          type: createProductDto.type,
          price: expect.any(Number),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        });
        expect(parseFloat(response.body.price.toString())).toBe(createProductDto.price);

        // Assert database persistence
        const savedProduct = await productRepo.findOne({
          where: { id: response.body.id },
        });
        expect(savedProduct).toMatchObject({
          id: response.body.id,
          name: createProductDto.name,
          type: createProductDto.type,
          price: expect.any(String),
        });
      }),
    );

    it(
      'should return 403 when CUSTOMER tries to create',
      runWithRollbackTransaction(async () => {
        const customerToken = await fixtures.fixtures.tokens.john();

        await request(app.getHttpServer())
          .post(baseUrl)
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            name: 'New Product',
            type: ProductType.SINGLE,
            price: 99.99,
          })
          .expect(403);
      }),
    );

    it(
      'should return 401 when token is missing',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer())
          .post(baseUrl)
          .send({
            name: 'New Product',
            type: ProductType.SINGLE,
            price: 99.99,
          })
          .expect(401);
      }),
    );

    it(
      'should validate required fields (name, type, price) and invalid values',
      runWithRollbackTransaction(async () => {
        const adminToken = await fixtures.fixtures.tokens.admin();

        const testCases = [
          { payload: { type: ProductType.SINGLE, price: 99.99 }, missing: 'name' },
          { payload: { name: 'Product', price: 99.99 }, missing: 'type' },
          { payload: { name: 'Product', type: ProductType.SINGLE }, missing: 'price' },
          { payload: { name: 'Product', type: ProductType.SINGLE, price: -10 }, invalid: 'negative price' },
          { payload: { name: 'Product', type: 'invalid', price: 99.99 }, invalid: 'invalid type' },
        ];

        for (const testCase of testCases) {
          await request(app.getHttpServer())
            .post(baseUrl)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(testCase.payload)
            .expect(400);
        }
      }),
    );
  });

  describe('GET /product', () => {
    it(
      'should return all products with correct structure',
      runWithRollbackTransaction(async () => {
        const customerToken = await fixtures.fixtures.tokens.john();
        // Products from fixtures should be included in the response

        const response = await request(app.getHttpServer())
          .get(baseUrl)
          .set('Authorization', `Bearer ${customerToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(6); // At least 6 products from fixtures

        // Assert product structure
        response.body.forEach((product) => {
          expect(product).toMatchObject({
            id: expect.any(String),
            name: expect.any(String),
            type: expect.stringMatching(/single|subscription/),
            price: expect.anything(), // Can be Number or String
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          });
          expect(['string', 'number']).toContain(typeof product.price);
        });
      }),
    );

    it(
      'should return 401 when token is missing',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer()).get(baseUrl).expect(401);
      }),
    );
  });

  describe('GET /product/:id', () => {
    it(
      'should return product with all fields when authenticated',
      runWithRollbackTransaction(async () => {
        const customerToken = await fixtures.fixtures.tokens.john();
        const product = await fixtures.fixtures.products.notebook();

        const response = await request(app.getHttpServer())
          .get(`${baseUrl}/${product.id}`)
          .set('Authorization', `Bearer ${customerToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          id: product.id,
          name: product.name,
          type: product.type,
          price: expect.anything(),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        });
        expect(['string', 'number']).toContain(typeof response.body.price);
        expect(parseFloat(response.body.price.toString())).toBe(parseFloat(product.price.toString()));
      }),
    );

    it(
      'should return 404 when product does not exist',
      runWithRollbackTransaction(async () => {
        const token = await fixtures.fixtures.tokens.john();

        await request(app.getHttpServer())
          .get(`${baseUrl}/00000000-0000-0000-0000-000000000000`)
          .set('Authorization', `Bearer ${token}`)
          .expect(404);
      }),
    );

    it(
      'should return 401 when token is missing',
      runWithRollbackTransaction(async () => {
        const product = await fixtures.fixtures.products.notebook();

        await request(app.getHttpServer())
          .get(`${baseUrl}/${product.id}`)
          .expect(401);
      }),
    );
  });

  describe('PATCH /product/:id', () => {
    it(
      'should update product partially and persist changes in database',
      runWithRollbackTransaction(async () => {
        const adminToken = await fixtures.fixtures.tokens.admin();
        const product = await fixtures.fixtures.products.gamingMouse();

        const updateData = { name: 'Updated Gaming Mouse', price: 249.99 };

        const response = await request(app.getHttpServer())
          .patch(`${baseUrl}/${product.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toMatchObject({
          id: product.id,
          name: updateData.name,
          price: expect.any(Number),
          type: product.type, // Unchanged
        });
        expect(parseFloat(response.body.price.toString())).toBe(updateData.price);

        // Verify database update
        const updatedProduct = await productRepo.findOne({
          where: { id: product.id },
        });
        expect(updatedProduct).toMatchObject({
          name: updateData.name,
          price: expect.any(String),
        });
      }),
    );

    it(
      'should allow CUSTOMER to update and return 404 when product not found',
      runWithRollbackTransaction(async () => {
        const customerToken = await fixtures.fixtures.tokens.mary();
        const product = await fixtures.fixtures.products.smartphone();
        const adminToken = await fixtures.fixtures.tokens.admin();

        // CUSTOMER can update (no role restriction on PATCH)
        const updateRes = await request(app.getHttpServer())
          .patch(`${baseUrl}/${product.id}`)
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ name: 'Updated by Customer' })
          .expect(200);

        expect(updateRes.body.name).toBe('Updated by Customer');

        await request(app.getHttpServer())
          .patch(`${baseUrl}/00000000-0000-0000-0000-000000000000`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: 'Updated' })
          .expect(404);
      }),
    );

    it(
      'should return 401 when token is missing',
      runWithRollbackTransaction(async () => {
        const product = await fixtures.fixtures.products.notebook();

        await request(app.getHttpServer())
          .patch(`${baseUrl}/${product.id}`)
          .send({ name: 'Updated' })
          .expect(401);
      }),
    );
  });

  describe('DELETE /product/:id', () => {
    it(
      'should soft delete product and persist deletedAt in database',
      runWithRollbackTransaction(async () => {
        const adminToken = await fixtures.fixtures.tokens.admin();
        const product = await fixtures.fixtures.products.gamingMouse();

        await request(app.getHttpServer())
          .delete(`${baseUrl}/${product.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(204);

        // Verify soft delete in database
        const deletedProduct = await productRepo.findOne({
          where: { id: product.id },
          withDeleted: true,
        });
        expect(deletedProduct?.deletedAt).toBeDefined();
        expect(deletedProduct?.deletedAt).toBeInstanceOf(Date);

        // Verify product is not returned in normal queries
        const normalProduct = await productRepo.findOne({
          where: { id: product.id },
        });
        expect(normalProduct).toBeNull();
      }),
    );

    it(
      'should allow CUSTOMER to delete and return 404 when product not found',
      runWithRollbackTransaction(async () => {
        const customerToken = await fixtures.fixtures.tokens.peter();
        const product = await fixtures.fixtures.products.monthlySubscription();
        const adminToken = await fixtures.fixtures.tokens.admin();

        // CUSTOMER can delete (no role restriction on DELETE)
        await request(app.getHttpServer())
          .delete(`${baseUrl}/${product.id}`)
          .set('Authorization', `Bearer ${customerToken}`)
          .expect(204);

        await request(app.getHttpServer())
          .delete(`${baseUrl}/00000000-0000-0000-0000-000000000000`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      }),
    );

    it(
      'should return 401 when token is missing',
      runWithRollbackTransaction(async () => {
        const product = await fixtures.fixtures.products.yearlySubscription();

        await request(app.getHttpServer())
          .delete(`${baseUrl}/${product.id}`)
          .expect(401);
      }),
    );
  });
});

