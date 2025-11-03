import { Logger } from '@nestjs/common';
import testDataSource from './test-datasource';

async function truncateAll() {
  try {
    await testDataSource.initialize();

    Logger.log('Conectado ao banco de dados de teste. Limpando dados...');

    // Obter lista de todas as tabelas (exceto migrations que é gerenciada pelo TypeORM)
    const queryRunner = testDataSource.createQueryRunner();
    
    const tables = await queryRunner.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename != 'migrations'
      ORDER BY tablename
    `);

    if (tables.length === 0) {
      Logger.log('Nenhuma tabela encontrada para truncar.');
      await testDataSource.destroy();
      return;
    }

    // Construir lista de nomes de tabelas
    const tableNames = tables.map((t: { tablename: string }) => `"${t.tablename}"`).join(', ');

    // Executar TRUNCATE CASCADE para limpar todas as tabelas respeitando foreign keys
    // RESTART IDENTITY reseta os sequences
    await queryRunner.query(`
      TRUNCATE TABLE ${tableNames} 
      RESTART IDENTITY 
      CASCADE
    `);

    Logger.log(`✓ Dados truncados de ${tables.length} tabela(s): ${tables.map((t: { tablename: string }) => t.tablename).join(', ')}`);

    await testDataSource.destroy();
    Logger.log('✓ Concluído com sucesso!');
  } catch (error) {
    Logger.error('Erro ao truncar tabelas:', error);
    if (testDataSource.isInitialized) {
      await testDataSource.destroy();
    }
    process.exit(1);
  }
}

truncateAll();

