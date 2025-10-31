import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import 'dotenv/config';

export const config: TypeOrmModuleOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  autoLoadEntities: true,
  logging: process.env.DATABASE_LOGGING === 'true',
  logger:
    (process.env.DATABASE_LOGGER as TypeOrmModuleOptions['logger']) ||
    'advanced-console',
  synchronize: false,
  migrationsRun: (process.env.DATABASE_MIGRATION_RUN || 'true') === 'true',
  migrations: [`${__dirname}/../infra/database/migrations/**/*{.ts,.js}`],
};

export default registerAs('database', () => ({
  ...config,
}));
