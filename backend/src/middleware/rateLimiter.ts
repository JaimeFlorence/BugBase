import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.connect();

export const rateLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient as any,
    prefix: 'rate-limit:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const strictRateLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient as any,
    prefix: 'rate-limit-strict:',
  }),
  windowMs: 15 * 60 * 1000,
  max: 10, // Stricter limit for sensitive endpoints
  message: 'Too many requests from this IP, please try again later.',
});