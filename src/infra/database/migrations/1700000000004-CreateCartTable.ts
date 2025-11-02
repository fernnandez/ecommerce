import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateCartTable1700000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Criar enum para CartStatus
    await queryRunner.query(`
      CREATE TYPE "cart_status_enum" AS ENUM('open', 'closed')
    `);

    // Criar tabela cart
    await queryRunner.createTable(
      new Table({
        name: 'cart',
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
            name: 'status',
            type: 'enum',
            enum: ['open', 'closed'],
            default: "'open'",
          },
          {
            name: 'total',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
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

    // Foreign key para customer
    await queryRunner.createForeignKey(
      'cart',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'customer',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('cart');
    const foreignKey = table?.foreignKeys.find(fk => fk.columnNames.indexOf('customer_id') !== -1);
    if (foreignKey) {
      await queryRunner.dropForeignKey('cart', foreignKey);
    }
    await queryRunner.dropTable('cart');
    await queryRunner.query(`DROP TYPE "cart_status_enum"`);
  }
}

