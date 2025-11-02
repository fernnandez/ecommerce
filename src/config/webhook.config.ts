import { registerAs } from '@nestjs/config';

export default registerAs('webhook', () => ({
  secret: process.env.WEBHOOK_SECRET || 'webhook-secret',
}));

