import * as Joi from 'joi';

export default Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test'),
  DATABASE_URL: Joi.string().required(),
  PORT: Joi.number(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.string().required(),
});
