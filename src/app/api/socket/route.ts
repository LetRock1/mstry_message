// src/app/api/socket/route.ts
import { Server } from 'socket.io';
import { NextRequest, NextResponse } from 'next/server';

// Singleton to hold the io instance
let io: Server | null = null;

export async function GET(req: NextRequest) {
  // If already initialized, just return OK
  if (io) {
    return NextResponse.json({ status: 'Socket.io already running' });
  }

  console.log('🚀 Initializing Socket.io server (first request)');

  // Get the underlying HTTP server from Next.js internals
  // This is safe but not typed — we use any here
  const httpServer = (global as any).httpServer || (req as any).socket?.server;

  if (!httpServer) {
    console.error('No HTTP server found - Socket.io cannot initialize');
    return NextResponse.json(
      { error: 'Server not ready' },
      { status: 500 }
    );
  }

  io = new Server(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('join-user-room', (username: string) => {
      if (username && typeof username === 'string') {
        socket.join(`user:${username}`);
        console.log(`User ${username} joined room user:${username}`);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Store io globally so API routes can emit
  (global as any).io = io;

  return NextResponse.json({ status: 'Socket.io initialized' });
}