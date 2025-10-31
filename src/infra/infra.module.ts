import { Module } from '@nestjs/common';
import { ConfigurationModule } from './configuration/configuration.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [ConfigurationModule, DatabaseModule, AuthModule],
  exports: [AuthModule],
})
export class InfraModule {}
