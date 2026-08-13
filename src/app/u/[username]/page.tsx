"use client";

import { useState, useEffect } from "react";
import { useSocket } from "@/hooks/useSocket";
import { Circle } from "lucide-react";

type Props = {
  params: {
    username: string;
  };
};

export default function Page({ params }: Props) {
  const { username } = params;
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [onlineStatus, setOnlineStatus] = useState<{ online: boolean; lastSeen: number | null }>({ online: false, lastSeen: null });
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const fetchInitial = async () => {
      const res = await fetch(`/api/user/status?username=${encodeURIComponent(username)}`);
      if (res.ok) setOnlineStatus(await res.json());
    };
    fetchInitial();

    const handleStatusChange = (data: any) => {
      if (data.username === username) {
        setOnlineStatus({ online: data.status === 'online', lastSeen: data.lastSeen });
      }
    };
    socket.on('user-status-changed', handleStatusChange);
    return () => { socket.off('user-status-changed', handleStatusChange); };
  }, [socket, username]);

  const handleSend = async () => {
    if (!message) return;
    setLoading(true);
    try {
      const res = await fetch("/api/send-message", {
        method: "POST",
        body: JSON.stringify({ username, content: message }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Message sent ✅");
        setMessage("");
      } else alert(data.message);
    } catch (err) {
      alert("Something went wrong");
    }
    setLoading(false);
  };

  const handleSuggest = async () => {
    try {
      const res = await fetch("/api/suggest-messages", { method: "POST" });
      const data = await res.json();
      if (data.success) setSuggestions(data.data.split("||"));
    } catch (err) {}
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      {/* Online status */}
      <div className="flex items-center gap-2 mb-4">
        <Circle className={`w-3 h-3 ${onlineStatus.online ? 'text-green-500 fill-green-500' : 'text-gray-400 fill-gray-400'}`} />
        <span className="text-sm">
          {onlineStatus.online ? 'Online' : onlineStatus.lastSeen ? `Last seen ${new Date(onlineStatus.lastSeen).toLocaleString()}` : 'Offline'}
        </span>
      </div>

      <h1 className="text-3xl font-bold mb-4">Send Anonymous Message to @{username}</h1>

      <textarea value={message} onChange={(e) => setMessage(e.target.value)}
        placeholder="Write your anonymous message..."
        className="w-full max-w-xl p-3 border rounded-lg mb-4" />

      <button onClick={handleSend} disabled={loading}
        className="bg-black text-white px-6 py-2 rounded-lg mb-4">
        {loading ? "Sending..." : "Send It"}
      </button>

      <button onClick={handleSuggest} className="bg-gray-300 px-4 py-2 rounded-lg mb-4">
        Suggest Messages
      </button>

      <div className="w-full max-w-xl">
        {suggestions.map((msg, index) => (
          <div key={index} onClick={() => setMessage(msg)}
            className="border p-2 rounded mb-2 cursor-pointer hover:bg-gray-100">
            {msg}
          </div>
        ))}
      </div>
    </div>
  );
}