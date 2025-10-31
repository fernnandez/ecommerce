import { ApplicationModule } from '@application/application.module';
import { DomainModule } from '@domain/domain.module';
import { InfraModule } from '@infra/infra.module';
import { IntegrationModule } from '@integration/integration.module';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ApplicationModule,
    DomainModule,
    InfraModule,
    IntegrationModule,
  ],
})
export class AppModule {}
