// Jest setup file
// This file runs before all tests

// Desabilitar logs do banco de dados durante testes para melhor performance
process.env.DATABASE_LOGGING = 'false';

// Configurar variáveis de ambiente necessárias para os testes
process.env.WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test-webhook-secret';
