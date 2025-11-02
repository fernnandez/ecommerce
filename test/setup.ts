// Jest setup file
// This file runs before all tests

process.env.NODE_ENV = 'test';

process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/ecommerce_test';
process.env.DATABASE_LOGGING = 'false';
process.env.DATABASE_MIGRATION_RUN = 'false';

process.env.WEBHOOK_SECRET = 'test-webhook-secret';
process.env.JWT_SECRET = 'test-jwt-secret';
