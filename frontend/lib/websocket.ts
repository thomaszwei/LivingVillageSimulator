"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LeaderboardEntry, UserData, WorldStateData } from "./types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function useSimulation() {
  const [state, setState] = useState<WorldStateData | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data: WorldStateData = JSON.parse(event.data);
        setState(data);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      reconnectTimer.current && clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendAction = useCallback(
    async (type: string, x: number, y: number, username?: string) => {
      try {
        const res = await fetch(`${API_URL}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, x, y, username: username ?? null }),
        });
        return await res.json();
      } catch (err) {
        console.error("Action failed", err);
        return { ok: false, error: "Network error" };
      }
    },
    [],
  );

  return { state, connected, sendAction };
}

// ── User API ──────────────────────────────────────────────────────────────────

export async function createOrGetUser(username: string): Promise<UserData> {
  const res = await fetch(`${API_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Failed to create user");
  }
  return res.json();
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_URL}/leaderboard`);
  if (!res.ok) throw new Error("Failed to fetch leaderboard");
  return res.json();
}

export async function castVote(
  disaster: string,
  username?: string,
): Promise<{ ok: boolean; votes?: Record<string, number>; error?: string }> {
  const res = await fetch(`${API_URL}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disaster, username: username ?? null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.detail ?? "Vote failed" };
  }
  return res.json();
}
