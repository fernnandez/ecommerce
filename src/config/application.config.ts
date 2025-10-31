import { LogLevel } from '@nestjs/common';
import { registerAs } from '@nestjs/config';

export default registerAs('application', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  logLevel: (process.env.LOG_LEVEL || 'verbose').split(',') as LogLevel[],

  //Helpers
  isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  },

  isTest(): boolean {
    return this.nodeEnv === 'test';
  },

  isProduction(): boolean {
    return this.nodeEnv === 'production';
  },
}));
