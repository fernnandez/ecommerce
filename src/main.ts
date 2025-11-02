import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { initializeTransactionalContext } from 'typeorm-transactional';
import { AppModule } from './app.module';

async function bootstrap() {
  initializeTransactionalContext();
  const app = await NestFactory.create(AppModule);

  // Helmet - Security HTTP Headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api');

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('E-commerce API')
    .setDescription(
      `API documentation for E-commerce application

## Rate Limits

Esta API implementa rate limiting para proteger contra abuso:

- **Limite Global**: 100 requisições por minuto por IP (aplicado a todas as rotas)
- **Rota de Login**: 5 requisições por minuto por IP (mais restritivo para prevenir brute force)

### Headers de Resposta

As respostas incluem headers informativos sobre rate limits:
- \`X-RateLimit-Limit\`: Limite total de requisições no período
- \`X-RateLimit-Remaining\`: Número de requisições restantes no período
- \`X-RateLimit-Reset\`: Timestamp (em segundos) quando o rate limit será resetado

### Status Code 429

Quando o limite é excedido, a API retorna:
- **Status**: 429 Too Many Requests
- **Body**: Mensagem de erro indicando que o rate limit foi excedido
- **Retry-After**: Header opcional indicando quantos segundos esperar antes de tentar novamente`,
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Webhook-Secret',
        in: 'header',
        description: 'Webhook secret for authentication',
      },
      'webhook-secret',
    )
    .addTag('health', 'Health check endpoints')
    .addTag('auth', 'Authentication endpoints')
    .addTag('admin - products', 'Product management (Admin only)')
    .addTag('admin - orders', 'Order management (Admin only)')
    .addTag('admin - subscriptions', 'Subscription billing management (Admin only)')
    .addTag('webhooks', 'Webhook endpoints')
    .addTag('customer - products', 'Product viewing (Customer)')
    .addTag('customer - customers', 'Customer management endpoints')
    .addTag('customer - cart', 'Cart management endpoints')
    .addTag('customer - orders', 'Order management endpoints')
    .addTag('customer - subscriptions', 'Subscription viewing endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      persistCredentials: true,
    },
    customSiteTitle: 'E-commerce API Documentation',
  });

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
