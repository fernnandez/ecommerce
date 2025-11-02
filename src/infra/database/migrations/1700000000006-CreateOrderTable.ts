import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateOrderTable1700000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Criar enums
    await queryRunner.query(`
      CREATE TYPE "order_status_enum" AS ENUM('pending', 'confirmed', 'failed', 'cancelled')
    `);

    await queryRunner.query(`
      CREATE TYPE "payment_method_enum" AS ENUM('card', 'slipbank', 'pix')
    `);

    await queryRunner.query(`
      CREATE TYPE "order_origin_enum" AS ENUM('cart', 'subscription')
    `);

    // Criar tabela order
    await queryRunner.createTable(
      new Table({
        name: 'order',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'customer_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'cart_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'total',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'confirmed', 'failed', 'cancelled'],
            default: "'pending'",
          },
          {
            name: 'payment_method',
            type: 'enum',
            enum: ['card', 'slipbank', 'pix'],
          },
          {
            name: 'origin',
            type: 'enum',
            enum: ['cart', 'subscription'],
            default: "'cart'",
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Foreign keys
    await queryRunner.createForeignKey(
      'order',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'customer',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'order',
      new TableForeignKey({
        columnNames: ['cart_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'cart',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('order');
    const foreignKeys = table?.foreignKeys || [];
    for (const foreignKey of foreignKeys) {
      await queryRunner.dropForeignKey('order', foreignKey);
    }
    await queryRunner.dropTable('order');
    await queryRunner.query(`DROP TYPE "order_origin_enum"`);
    await queryRunner.query(`DROP TYPE "payment_method_enum"`);
    await queryRunner.query(`DROP TYPE "order_status_enum"`);
  }
}

