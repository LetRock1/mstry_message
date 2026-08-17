'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

let globalSocket: Socket | null = null;

export function useSocket() {
  const { data: session } = useSession();
  const [socket, setSocket] = useState<Socket | null>(globalSocket);

  useEffect(() => {
    if (!session?.user?.username) return;

    if (!globalSocket) {
      const newSocket = io({
        path: '/socket.io',
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
      });
      globalSocket = newSocket;
      setSocket(newSocket);
    } else {
      setSocket(globalSocket);
    }

    const currentSocket = globalSocket;

    currentSocket.on('connect', () => {
      console.log('✅ Socket connected, emitting join-room');
      // Explicitly join the user's room
      currentSocket.emit('join-room', session.user.username);
    });

    currentSocket.connect();

    return () => {
      currentSocket.off('connect');
      // keep singleton alive
    };
  }, [session?.user?.username]);

  return socket;
}