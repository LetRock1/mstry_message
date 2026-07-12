import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redis } from './src/lib/redis.js';


const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true); // removed the TS non-null assertion
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: '*', // change to your domain in production
      methods: ['GET', 'POST'],
    },
  });

  // Attach Redis adapter → distributed / scalable
  io.adapter(createAdapter(redis, redis.duplicate()));

  // Socket.io logic
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // User joins their personal room (by username)
    socket.on('join-user-room', (username) => {
      if (username) {
        socket.join(`user:${username}`);
        console.log(`${username} joined room user:${username}`);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Make io available to API routes
  global.io = io; // removed TS type assertion

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
