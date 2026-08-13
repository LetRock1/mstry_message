import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { getToken } from 'next-auth/jwt';
import { redisConnection, redis } from './src/lib/redis.ts';
import { initMessageWorker } from './src/workers/messageWorker.ts';

// Simple cookie parser (no external package needed)
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    if (name) cookies[name] = decodeURIComponent(value);
  });
  return cookies;
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Redis adapter
  const pubClient = redisConnection;
  const subClient = redisConnection.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const rawCookies = socket.handshake.headers.cookie;
      if (!rawCookies) return next(new Error('No cookies'));

      const parsed = parseCookies(rawCookies);
      const tokenKey = process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token';

      const token = await getToken({
        req: {
          headers: socket.handshake.headers,
          cookies: parsed,   // now a plain object
        },
        secret: process.env.NEXTAUTH_SECRET,
      });

      if (!token?.username) return next(new Error('Invalid token'));

      socket.data.username = token.username;
      next();
    } catch (err) {
      console.error('Socket Auth Error:', err.message);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket) => {
    const username = socket.data.username;
    console.log(`User connected: ${username}`);
    socket.join(`user:${username}`);

    // Online presence
    await redis.sadd('online_users', username);
    await redis.set(`lastseen:${username}`, Date.now());
    io.emit('user-status-changed', { username, status: 'online', lastSeen: null });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${username}`);
      await redis.srem('online_users', username);
      const lastSeen = Date.now();
      await redis.set(`lastseen:${username}`, lastSeen);
      io.emit('user-status-changed', { username, status: 'offline', lastSeen });
    });
  });

  global.io = io;
  initMessageWorker();

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});