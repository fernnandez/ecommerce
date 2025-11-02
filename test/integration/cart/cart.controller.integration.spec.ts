import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from '@src/app.module';
import { Cart, CartStatus } from '@src/domain/cart/entities/cart.entity';
import { createTestingApp } from '@test/helper/create-testing-app';
import { runWithRollbackTransaction } from '@test/helper/database/test-transaction';
import { FixtureHelper } from '@test/helper/fixture-helper';
import request from 'supertest';
import { Repository } from 'typeorm';

describe('CartController - Integration (HTTP)', () => {
  let app: INestApplication;
  let fixtures: FixtureHelper;
  let cartRepo: Repository<Cart>;

  const baseUrl = '/cart';

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
    cartRepo = app.get<Repository<Cart>>(getRepositoryToken(Cart));
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  describe('POST /cart/open', () => {
    it(
      'should create a new cart successfully',
      runWithRollbackTransaction(async () => {
        const token = await fixtures.fixtures.tokens.peter();

        const response = await request(app.getHttpServer())
          .post(`${baseUrl}/open`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toMatchObject({
          id: expect.any(String),
          status: CartStatus.OPEN,
          total: 0,
          items: [],
        });

        // Verify database persistence
        const savedCart = await cartRepo.findOne({
          where: { id: response.body.id },
        });
        expect(savedCart).toMatchObject({
          id: response.body.id,
          status: CartStatus.OPEN,
        });
      }),
    );

    it(
      'should return existing open cart if one already exists',
      runWithRollbackTransaction(async () => {
        const token = await fixtures.fixtures.tokens.john();

        const firstResponse = await request(app.getHttpServer())
          .post(`${baseUrl}/open`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        const secondResponse = await request(app.getHttpServer())
          .post(`${baseUrl}/open`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(firstResponse.body.id).toBe(secondResponse.body.id);
      }),
    );

    it(
      'should return 401 when token is missing',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer()).post(`${baseUrl}/open`).expect(401);
      }),
    );
  });

  describe('GET /cart', () => {
    it(
      'should return open cart with items and correct structure',
      runWithRollbackTransaction(async () => {
        const token = await fixtures.fixtures.tokens.john();
        // John has an active cart from fixtures with items

        const response = await request(app.getHttpServer())
          .get(baseUrl)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toMatchObject({
          id: expect.any(String),
          status: CartStatus.OPEN,
          total: expect.any(Number),
          items: expect.any(Array),
        });

        expect(response.body.items.length).toBeGreaterThan(0);
        // Verify structure of items from fixtures
        response.body.items.forEach(item => {
          expect(item).toMatchObject({
            id: expect.any(String),
            productId: expect.any(String),
            productName: expect.any(String),
            quantity: expect.any(Number),
            price: expect.any(Number),
          });
        });
      }),
    );

    it(
      'should return 404 when no open cart exists',
      runWithRollbackTransaction(async () => {
        const token = await fixtures.fixtures.tokens.mary();
        // Mary has only closed carts in fixtures, no open cart

        await request(app.getHttpServer()).get(baseUrl).set('Authorization', `Bearer ${token}`).expect(404);
      }),
    );

    it(
      'should return 401 when token is missing',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer()).get(baseUrl).expect(401);
      }),
    );
  });

  describe('POST /cart/items', () => {
    it(
      'should add item to cart and calculate total correctly',
      runWithRollbackTransaction(async () => {
        const token = await fixtures.fixtures.tokens.mary();
        const product = await fixtures.fixtures.products.smartphone();

        // Get initial cart state (may be null if no open cart)
        const initialCartResponse = await request(app.getHttpServer())
          .get(baseUrl)
          .set('Authorization', `Bearer ${token}`);

        const initialTotal =
          initialCartResponse.status === 200 ? parseFloat(initialCartResponse.body.total.toString()) : 0;

        const response = await request(app.getHttpServer())
          .post(`${baseUrl}/items`)
          .set('Authorization', `Bearer ${token}`)
          .send({ productId: product.id, quantity: 2 })
          .expect(200);

        expect(response.body).toMatchObject({
          id: expect.any(String),
          status: CartStatus.OPEN,
          total: expect.any(Number),
          items: expect.arrayContaining([
            expect.objectContaining({
              productId: product.id,
              quantity: 2,
              price: expect.any(Number),
            }),
          ]),
        });

        // Verify total calculation includes existing items + new item
        const newItemTotal = parseFloat(product.price.toString()) * 2;
        const expectedTotal = initialTotal + newItemTotal;
        expect(parseFloat(response.body.total.toString())).toBeCloseTo(expectedTotal, 2);
      }),
    );

    it(
      'should increase quantity if product already in cart',
      runWithRollbackTransaction(async () => {
        const token = await fixtures.fixtures.tokens.peter();
        const product = await fixtures.fixtures.products.gamingMouse();

        // Add first time
        await request(app.getHttpServer())
          .post(`${baseUrl}/items`)
          .set('Authorization', `Bearer ${token}`)
          .send({ productId: product.id, quantity: 1 })
          .expect(200);

        // Add again
        const response = await request(app.getHttpServer())
          .post(`${baseUrl}/items`)
          .set('Authorization', `Bearer ${token}`)
          .send({ productId: product.id, quantity: 2 })
          .expect(200);

        const productItem = response.body.items.find(item => item.productId === product.id);
        expect(productItem).toBeDefined();
        expect(productItem.quantity).toBe(3);
      }),
    );

    it(
      'should create cart automatically if it does not exist',
      runWithRollbackTransaction(async () => {
        const token = await fixtures.fixtures.tokens.peter();
        const product = await fixtures.fixtures.products.notebook();

        const response = await request(app.getHttpServer())
          .post(`${baseUrl}/items`)
          .set('Authorization', `Bearer ${token}`)
          .send({ productId: product.id })
          .expect(200);

        expect(response.body.id).toBeDefined();
        expect(response.body.status).toBe(CartStatus.OPEN);
      }),
    );

    it(
      'should validate required fields and invalid values',
      runWithRollbackTransaction(async () => {
        const token = await fixtures.fixtures.tokens.john();

        const testCases = [
          { payload: { quantity: 1 }, missing: 'productId' },
          { payload: { productId: 'invalid-uuid' }, invalid: 'invalid UUID' },
          { payload: { productId: '00000000-0000-0000-0000-000000000000', quantity: 0 }, invalid: 'quantity < 1' },
          {
            payload: { productId: '00000000-0000-0000-0000-000000000000', quantity: -1 },
            invalid: 'negative quantity',
          },
        ];

        for (const testCase of testCases) {
          await request(app.getHttpServer())
            .post(`${baseUrl}/items`)
            .set('Authorization', `Bearer ${token}`)
            .send(testCase.payload)
            .expect(400);
        }
      }),
    );

    it(
      'should return 404 when product does not exist',
      runWithRollbackTransaction(async () => {
        const token = await fixtures.fixtures.tokens.mary();

        await request(app.getHttpServer())
          .post(`${baseUrl}/items`)
          .set('Authorization', `Bearer ${token}`)
          .send({ productId: '00000000-0000-0000-0000-000000000000' })
          .expect(404);
      }),
    );

    it(
      'should return 401 when token is missing',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer())
          .post(`${baseUrl}/items`)
          .send({ productId: '00000000-0000-0000-0000-000000000000' })
          .expect(401);
      }),
    );
  });

  describe('DELETE /cart/items/:itemId', () => {
    it(
      'should remove item from cart and recalculate total',
      runWithRollbackTransaction(async () => {
        const token = await fixtures.fixtures.tokens.peter();
        const product1 = await fixtures.fixtures.products.notebook();
        const product2 = await fixtures.fixtures.products.gamingMouse();

        // Add items to a clean cart
        await request(app.getHttpServer())
          .post(`${baseUrl}/items`)
          .set('Authorization', `Bearer ${token}`)
          .send({ productId: product1.id, quantity: 1 })
          .expect(200);

        const cartAfterBothItems = await request(app.getHttpServer())
          .post(`${baseUrl}/items`)
          .set('Authorization', `Bearer ${token}`)
          .send({ productId: product2.id, quantity: 1 })
          .expect(200);

        // Find the item to remove
        const itemToRemove = cartAfterBothItems.body.items.find(item => item.productId === product1.id);
        expect(itemToRemove).toBeDefined();

        // Get current total before removal (after both items added)
        const totalBeforeRemoval = parseFloat(cartAfterBothItems.body.total.toString());
        const product1Price = parseFloat(product1.price.toString());
        const expectedTotalAfterRemoval = totalBeforeRemoval - product1Price;

        const removeResponse = await request(app.getHttpServer())
          .delete(`${baseUrl}/items/${itemToRemove.id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(removeResponse.body.items.find(item => item.productId === product1.id)).toBeUndefined();
        expect(removeResponse.body.items.find(item => item.productId === product2.id)).toBeDefined();
        expect(parseFloat(removeResponse.body.total.toString())).toBeCloseTo(expectedTotalAfterRemoval, 2);
      }),
    );

    it(
      'should return 404 when item does not exist',
      runWithRollbackTransaction(async () => {
        const token = await fixtures.fixtures.tokens.mary();

        await request(app.getHttpServer())
          .delete(`${baseUrl}/items/00000000-0000-0000-0000-000000000000`)
          .set('Authorization', `Bearer ${token}`)
          .expect(404);
      }),
    );

    it(
      'should return 401 when token is missing',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer()).delete(`${baseUrl}/items/00000000-0000-0000-0000-000000000000`).expect(401);
      }),
    );
  });

  describe('POST /cart/close', () => {
    it(
      'should close cart with items successfully',
      runWithRollbackTransaction(async () => {
        const token = await fixtures.fixtures.tokens.peter();
        const product = await fixtures.fixtures.products.smartphone();

        // Add item to cart
        await request(app.getHttpServer())
          .post(`${baseUrl}/items`)
          .set('Authorization', `Bearer ${token}`)
          .send({ productId: product.id, quantity: 1 })
          .expect(200);

        const response = await request(app.getHttpServer())
          .post(`${baseUrl}/close`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.status).toBe(CartStatus.CLOSED);

        // Verify database
        const closedCart = await cartRepo.findOne({
          where: { id: response.body.id },
        });
        expect(closedCart?.status).toBe(CartStatus.CLOSED);
      }),
    );

    it(
      'should return 400 when trying to close empty cart',
      runWithRollbackTransaction(async () => {
        const token = await fixtures.fixtures.tokens.john();

        // Create empty cart
        await request(app.getHttpServer()).post(`${baseUrl}/open`).set('Authorization', `Bearer ${token}`).expect(200);

        await request(app.getHttpServer()).post(`${baseUrl}/close`).set('Authorization', `Bearer ${token}`).expect(400);
      }),
    );

    it(
      'should return 404 when no open cart exists',
      runWithRollbackTransaction(async () => {
        const token = await fixtures.fixtures.tokens.mary();
        // Mary may have a closed cart from fixtures, so no open cart exists

        await request(app.getHttpServer()).post(`${baseUrl}/close`).set('Authorization', `Bearer ${token}`).expect(404);
      }),
    );

    it(
      'should return 401 when token is missing',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer()).post(`${baseUrl}/close`).expect(401);
      }),
    );
  });

  describe('POST /cart/:id/checkout', () => {
    it(
      'should checkout cart successfully and create order',
      runWithRollbackTransaction(async () => {
        const token = await fixtures.fixtures.tokens.peter();
        const product = await fixtures.fixtures.products.notebook();

        // Add item and get cart
        const cartResponse = await request(app.getHttpServer())
          .post(`${baseUrl}/items`)
          .set('Authorization', `Bearer ${token}`)
          .send({ productId: product.id, quantity: 1 })
          .expect(200);

        const response = await request(app.getHttpServer())
          .post(`${baseUrl}/${cartResponse.body.id}/checkout`)
          .set('Authorization', `Bearer ${token}`)
          .send({ paymentMethod: 'card' })
          .expect(200);

        expect(response.body).toMatchObject({
          orderId: expect.any(String),
          orderStatus: expect.any(String),
          orderTotal: expect.any(Number),
          paymentMethod: 'card',
          transactions: expect.any(Array),
        });

        // Verify cart is closed
        const closedCart = await cartRepo.findOne({
          where: { id: cartResponse.body.id },
        });
        expect(closedCart?.status).toBe(CartStatus.CLOSED);
      }),
    );

    it(
      'should validate payment method and return 400 for empty cart',
      runWithRollbackTransaction(async () => {
        const token = await fixtures.fixtures.tokens.john();

        // Create empty cart
        const cartResponse = await request(app.getHttpServer())
          .post(`${baseUrl}/open`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        await request(app.getHttpServer())
          .post(`${baseUrl}/${cartResponse.body.id}/checkout`)
          .set('Authorization', `Bearer ${token}`)
          .send({ paymentMethod: 'card' })
          .expect(400);
      }),
    );

    it(
      'should return 404 when cart does not exist',
      runWithRollbackTransaction(async () => {
        const token = await fixtures.fixtures.tokens.mary();

        await request(app.getHttpServer())
          .post(`${baseUrl}/00000000-0000-0000-0000-000000000000/checkout`)
          .set('Authorization', `Bearer ${token}`)
          .send({ paymentMethod: 'card' })
          .expect(404);
      }),
    );

    it(
      'should return 401 when token is missing',
      runWithRollbackTransaction(async () => {
        await request(app.getHttpServer())
          .post(`${baseUrl}/00000000-0000-0000-0000-000000000000/checkout`)
          .send({ paymentMethod: 'card' })
          .expect(401);
      }),
    );
  });
});
