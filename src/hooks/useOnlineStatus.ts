'use client';

import { useEffect, useState } from 'react';
import { useSocket } from './useSocket';

type UserStatus = {
  online: boolean;
  lastSeen: number | null;
};

export function useOnlineStatus(username: string | undefined): UserStatus {
  const socket = useSocket();
  const [status, setStatus] = useState<UserStatus>({ online: false, lastSeen: null });

  useEffect(() => {
    if (!username || !socket) return;

    // Fetch initial status via HTTP
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/user/status?username=${encodeURIComponent(username)}`);
        if (res.ok) {
          const data = await res.json();
          setStatus({ online: data.online, lastSeen: data.lastSeen });
        }
      } catch (e) {}
    };
    fetchStatus();

    // Listen for real-time updates
    const handleStatusChange = (data: { username: string; status: string; lastSeen: number | null }) => {
      if (data.username === username) {
        setStatus({
          online: data.status === 'online',
          lastSeen: data.lastSeen,
        });
      }
    };

    socket.on('user-status-changed', handleStatusChange);
    return () => {
      socket.off('user-status-changed', handleStatusChange);
    };
  }, [username, socket]);

  return status;
}