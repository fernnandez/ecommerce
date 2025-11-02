import 'dotenv/config';
import { join } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';

// Configuração específica para testes
const getTestDatabaseUrl = (): string => {
  return 'postgresql://postgres:postgres@localhost:5432/ecommerce_test';
};

const testDataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: getTestDatabaseUrl(),
  entities: [join(__dirname, '../../../src/**/*.entity{.ts,.js}')],
  synchronize: true,
  logging: false,
  migrationsRun: false,
  dropSchema: false,
};

const testDataSource = new DataSource(testDataSourceOptions);
export default testDataSource;
