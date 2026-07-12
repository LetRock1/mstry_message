// socket-server.ts (standalone Socket.io server for local dev)
import { createServer } from 'http';
import { Server } from 'socket.io';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
  path: '/socket.io',
});

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('join-user-room', (username: string) => {
    if (username) {
      socket.join(`user:${username}`);
      console.log(`User ${username} joined room user:${username}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = 3001; // Different port from Next.js
httpServer.listen(PORT, () => {
  console.log(`Socket.io server running on http://localhost:${PORT}`);
});

// Export io for potential use in API routes (optional)
export { io };