import { redis } from './redis';
import UserModel from '@/model/User';
import dbConnect from './dbConnect';

// IP Rate Limiter (Max 5 requests per 60 seconds)
export async function checkRateLimit(ip: string, limit = 5, windowInSeconds = 60) {
  const key = `ratelimit:${ip}`;
  const currentRequests = await redis.incr(key);

  if (currentRequests === 1) {
    await redis.expire(key, windowInSeconds);
  }

  if (currentRequests > limit) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: limit - currentRequests };
}

// Check if user is accepting messages (Cache Hit: ~1ms)
export async function isUserAcceptingMessages(username: string): Promise<boolean> {
  const cacheKey = `user:${username}:accepting`;
  const cachedStatus = await redis.get(cacheKey);

  if (cachedStatus !== null) {
    return cachedStatus === 'true';
  }

  // Cache Miss: Query MongoDB once and cache for 1 hour
  await dbConnect();
  const user = await UserModel.findOne({ username }).select('isAcceptingMessage').lean();
  
  if (!user) return false;

  const status = user.isAcceptingMessage ? 'true' : 'false';
  await redis.set(cacheKey, status, 'EX', 3600);
  return user.isAcceptingMessage;
}