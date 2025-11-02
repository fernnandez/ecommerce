import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateSubscriptionTable1700000000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Criar enums (verificar se já existem)
    const periodicityEnumExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'periodicity_enum'
      )
    `);

    if (!periodicityEnumExists[0].exists) {
      await queryRunner.query(`
        CREATE TYPE "periodicity_enum" AS ENUM('monthly', 'quarterly', 'yearly')
      `);
    }

    await queryRunner.query(`
      CREATE TYPE "subscription_status_enum" AS ENUM('ACTIVE', 'PENDING', 'PAST_DUE', 'CANCELED')
    `);

    // Criar tabela subscription
    await queryRunner.createTable(
      new Table({
        name: 'subscription',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'subscription_id',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'customer_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'product_id',
            type: 'uuid',
            isNullable: true,
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
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['ACTIVE', 'PENDING', 'PAST_DUE', 'CANCELED'],
            default: "'PENDING'",
          },
          {
            name: 'next_billing_date',
            type: 'date',
          },
          {
            name: 'start_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'varchar',
            length: '255',
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

    // Foreign keys
    await queryRunner.createForeignKey(
      'subscription',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'customer',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'subscription',
      new TableForeignKey({
        columnNames: ['product_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'product',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('subscription');
    const foreignKeys = table?.foreignKeys || [];
    for (const foreignKey of foreignKeys) {
      await queryRunner.dropForeignKey('subscription', foreignKey);
    }
    await queryRunner.dropTable('subscription');
    await queryRunner.query(`DROP TYPE "subscription_status_enum"`);
  }
}

