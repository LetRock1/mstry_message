import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://:mysecretpassword@redis:6379';

export const redis = new Redis(redisUrl, {
  // Optional: retry strategy for connection issues
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});