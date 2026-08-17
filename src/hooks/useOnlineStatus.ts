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
    if (!username) return;

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

    // Polling fallback every 10 seconds
    const interval = setInterval(fetchStatus, 10000);

    if (socket) {
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
        clearInterval(interval);
        socket.off('user-status-changed', handleStatusChange);
      };
    }

    return () => clearInterval(interval);
  }, [username, socket]);

  return status;
}