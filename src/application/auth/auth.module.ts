import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { UserModule } from '@domain/user/user.module';
import { AuthModule as InfraAuthModule } from '@infra/auth/auth.module';

@Module({
  imports: [UserModule, InfraAuthModule],
  controllers: [AuthController],
})
export class AuthModule {}

