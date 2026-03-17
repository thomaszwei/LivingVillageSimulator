"use client";

import { useState } from "react";
import type { UserData } from "@/lib/types";
import { createOrGetUser } from "@/lib/websocket";

interface Props {
  onLogin: (user: UserData) => void;
}

export default function UserLogin({ onLogin }: Props) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      const user = await createOrGetUser(name);
      localStorage.setItem("village_username", user.username);
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-1">Welcome</h2>
        <p className="text-sm text-gray-400 mb-6">
          Enter a name to join the simulation. You start with{" "}
          <span className="text-amber-400 font-semibold">100 credits</span>.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your name"
            maxLength={32}
            autoFocus
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-lg transition-colors"
          >
            {loading ? "Joining..." : "Play"}
          </button>
        </form>

        <div className="mt-5 border-t border-gray-800 pt-4 space-y-1 text-xs text-gray-500">
          <p>Action costs: Plant Tree 5 cr · Build House 15 cr</p>
          <p>Start Fire 10 cr · Trigger Rain 20 cr</p>
        </div>
      </div>
    </div>
  );
}
