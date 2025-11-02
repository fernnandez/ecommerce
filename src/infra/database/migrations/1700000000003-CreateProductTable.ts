import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateProductTable1700000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Criar enums
    await queryRunner.query(`
      CREATE TYPE "product_type_enum" AS ENUM('single', 'subscription')
    `);

    await queryRunner.query(`
      CREATE TYPE "periodicity_enum" AS ENUM('monthly', 'quarterly', 'yearly')
    `);

    // Criar tabela product
    await queryRunner.createTable(
      new Table({
        name: 'product',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['single', 'subscription'],
            default: "'single'",
          },
          {
            name: 'price',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'periodicity',
            type: 'enum',
            enum: ['monthly', 'quarterly', 'yearly'],
            isNullable: true,
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('product');
    await queryRunner.query(`DROP TYPE "periodicity_enum"`);
    await queryRunner.query(`DROP TYPE "product_type_enum"`);
  }
}

