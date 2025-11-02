// Desabilitar logs do banco de dados durante testes para melhor performance
process.env.DATABASE_LOGGING = 'false';

// Configurar WEBHOOK_SECRET para testes (deve corresponder ao default do webhook.config.ts)
process.env.WEBHOOK_SECRET = 'webhook-secret';
