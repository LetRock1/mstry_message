import { NextRequest } from 'next/server';
import { redis } from '@/lib/redis';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  if (!username) {
    return Response.json({ error: 'username required' }, { status: 400 });
  }

  try {
    const isOnline = await redis.sismember('online_users', username);
    const lastSeen = await redis.get(`lastseen:${username}`);
    return Response.json({
      online: isOnline === 1,
      lastSeen: lastSeen ? parseInt(lastSeen, 10) : null,
    });
  } catch (error) {
    return Response.json({ online: false, lastSeen: null });
  }
}