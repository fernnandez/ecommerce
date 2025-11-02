import applicationConfig from '@config/application.config';
import databaseConfig from '@config/database.config';
import jwtConfig from '@config/jwt.config';
import webhookConfig from '@config/webhook.config';
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
