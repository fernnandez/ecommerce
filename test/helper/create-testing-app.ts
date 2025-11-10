import { INestApplication, Logger, ModuleMetadata, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

export interface CreateTestingAppOptions {
  imports?: ModuleMetadata['imports'];
  providers?: ModuleMetadata['providers'];
  controllers?: ModuleMetadata['controllers'];
  globalPipes?: boolean;
  enableLogs?: boolean;
}

export async function createTestingApp(options: CreateTestingAppOptions = {}): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: options.imports || [],
    providers: options.providers || [],
    controllers: options.controllers || [],
  }).compile();

  const app = moduleRef.createNestApplication();

  if (options.enableLogs === true) {
    const logger = new Logger('TestApp');

    app.use((req, res, next) => {
      logger.log(`[${req.method}] ${req.url} - Body: ${JSON.stringify(req.body)}`);
      next();
    });

    app.use((err, req, res, next) => {
      logger.error(`Error in ${req.method} ${req.url}: ${err.message}`, err.stack);
      next(err);
    });

    app.useLogger(['error', 'warn', 'log', 'debug', 'verbose']);
  } else {
    app.useLogger(false);
  }

  if (options.globalPipes !== false) {
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
  }
  await app.init();
  return app;
}
