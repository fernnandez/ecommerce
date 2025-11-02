import { config } from '@src/infra/configuration/configs/database.config';
import { DataSource, DataSourceOptions } from 'typeorm';

interface DatabaseConfig {
  url?: string;
  migrations?: string[];
  synchronize?: boolean;
  logging?: boolean;
  logger?: 'debug' | 'advanced-console' | 'simple-console' | 'formatted-console' | 'file';
  migrationsRun?: boolean;
}

const dbConfig = config as DatabaseConfig;

const extraConfig: DataSourceOptions = {
  type: 'postgres',
  url: dbConfig.url,
  entities: [`${__dirname}/../../**/*.entity{.ts,.js}`],
  migrations: dbConfig.migrations,
  synchronize: dbConfig.synchronize,
  logging: dbConfig.logging,
  logger: dbConfig.logger,
  migrationsRun: dbConfig.migrationsRun,
};

const datasource = new DataSource(extraConfig);
export default datasource;
