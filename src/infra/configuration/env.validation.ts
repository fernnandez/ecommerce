import * as Joi from 'joi';

export default Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test'),
  DATABASE_URL: Joi.string().required(),
  PORT: Joi.number(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('24h'),
  JWT_REFRESH_SECRET: Joi.string().optional(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  WEBHOOK_SECRET: Joi.string().required(),
});
