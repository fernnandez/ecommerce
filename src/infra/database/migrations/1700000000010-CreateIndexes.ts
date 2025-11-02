import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIndexes1700000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Índices para Cart
    await queryRunner.query(`
      CREATE INDEX "IDX_cart_customer_status" ON "cart" ("customer_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_cart_status" ON "cart" ("status")
    `);

    // Índices para CartItem
    await queryRunner.query(`
      CREATE INDEX "IDX_cart_item_cart_product" ON "cart_item" ("cart_id", "product_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_cart_item_cart" ON "cart_item" ("cart_id")
    `);

    // Índices para Order
    await queryRunner.query(`
      CREATE INDEX "IDX_order_customer" ON "order" ("customer_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_order_status" ON "order" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_order_customer_status" ON "order" ("customer_id", "status")
    `);

    // Índices para Transaction
    await queryRunner.query(`
      CREATE INDEX "IDX_transaction_order" ON "transaction" ("order_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_transaction_status" ON "transaction" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_transaction_order_status" ON "transaction" ("order_id", "status")
    `);

    // Índices para Subscription
    await queryRunner.query(`
      CREATE INDEX "IDX_subscription_customer" ON "subscription" ("customer_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_subscription_status" ON "subscription" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_subscription_customer_status" ON "subscription" ("customer_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_subscription_next_billing_date" ON "subscription" ("next_billing_date")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_subscription_status_next_billing_date" ON "subscription" ("status", "next_billing_date")
    `);

    // Índices para SubscriptionPeriod
    await queryRunner.query(`
      CREATE INDEX "IDX_subscription_period_subscription" ON "subscription_period" ("subscription_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_subscription_period_order" ON "subscription_period" ("order_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_subscription_period_status" ON "subscription_period" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_subscription_period_start_end_date" ON "subscription_period" ("start_date", "end_date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remover índices em ordem inversa
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_subscription_period_start_end_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_subscription_period_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_subscription_period_order"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_subscription_period_subscription"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_subscription_status_next_billing_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_subscription_next_billing_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_subscription_customer_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_subscription_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_subscription_customer"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transaction_order_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transaction_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transaction_order"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_customer_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_customer"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cart_item_cart"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cart_item_cart_product"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cart_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cart_customer_status"`);
  }
}

