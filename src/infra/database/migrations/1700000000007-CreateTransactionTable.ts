import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateTransactionTable1700000000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Criar enum para TransactionStatus
    await queryRunner.query(`
      CREATE TYPE "transaction_status_enum" AS ENUM('created', 'failed', 'paid', 'refused', 'processing')
    `);

    // Criar tabela transaction
    await queryRunner.createTable(
      new Table({
        name: 'transaction',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'transaction_id',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'order_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['created', 'failed', 'paid', 'refused', 'processing'],
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            default: "'BRL'",
          },
          {
            name: 'message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'processing_time',
            type: 'integer',
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

    // Foreign key para order
    await queryRunner.createForeignKey(
      'transaction',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'order',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('transaction');
    const foreignKey = table?.foreignKeys.find(fk => fk.columnNames.indexOf('order_id') !== -1);
    if (foreignKey) {
      await queryRunner.dropForeignKey('transaction', foreignKey);
    }
    await queryRunner.dropTable('transaction');
    await queryRunner.query(`DROP TYPE "transaction_status_enum"`);
  }
}

