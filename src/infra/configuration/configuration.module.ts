import applicationConfig from '@config/application.config';
import databaseConfig from '@config/database.config';
import jwtConfig from '@config/jwt.config';
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
      load: [applicationConfig, databaseConfig, jwtConfig],
      isGlobal: true,
    }),
  ],
})
export class ConfigurationModule {}
