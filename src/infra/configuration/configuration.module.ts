import applicationConfig from '@src/infra/configuration/configs/application.config';
import databaseConfig from '@src/infra/configuration/configs/database.config';
import jwtConfig from '@src/infra/configuration/configs/jwt.config';
import webhookConfig from '@src/infra/configuration/configs/webhook.config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import envValidation from './env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      expandVariables: true,
      validationSchema: envValidation,
      validationOptions: {
        abortEarly: true,
      },
      load: [applicationConfig, databaseConfig, jwtConfig, webhookConfig],
      isGlobal: true,
    }),
  ],
})
export class ConfigurationModule {}
