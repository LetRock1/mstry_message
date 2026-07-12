"use client";

import { useState } from "react";

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

  // 🔥 Send message
  const handleSend = async () => {
    if (!message) return;

    setLoading(true);

    try {
      const res = await fetch("/api/send-message", {
        method: "POST",
        body: JSON.stringify({
          username,
          content: message,
        }),
      });

      const data = await res.json();

      if (data.success) {
        alert("Message sent ✅");
        setMessage("");
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    }

    setLoading(false);
  };

  // 🤖 Get AI suggestions
  const handleSuggest = async () => {
    try {
      const res = await fetch("/api/suggest-messages", {
        method: "POST",
      });

      const data = await res.json();

      if (data.success) {
        const msgs = data.data.split("||");
        setSuggestions(msgs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      
      <h1 className="text-3xl font-bold mb-4">
        Send Anonymous Message to @{username}
      </h1>

      {/* Input */}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Write your anonymous message..."
        className="w-full max-w-xl p-3 border rounded-lg mb-4"
      />

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={loading}
        className="bg-black text-white px-6 py-2 rounded-lg mb-4"
      >
        {loading ? "Sending..." : "Send It"}
      </button>

      {/* Suggest button */}
      <button
        onClick={handleSuggest}
        className="bg-gray-300 px-4 py-2 rounded-lg mb-4"
      >
        Suggest Messages
      </button>

      {/* Suggestions */}
      <div className="w-full max-w-xl">
        {suggestions.map((msg, index) => (
          <div
            key={index}
            onClick={() => setMessage(msg)}
            className="border p-2 rounded mb-2 cursor-pointer hover:bg-gray-100"
          >
            {msg}
          </div>
        ))}
      </div>
    </div>
  );
}