"use client";

import { useEffect, useState } from "react";
import Controls from "@/components/Controls";
import EventLog from "@/components/EventLog";
import Leaderboard from "@/components/Leaderboard";
import Sidebar from "@/components/Sidebar";
import UserLogin from "@/components/UserLogin";
import WorldCanvas from "@/components/WorldCanvas";
import type { ActionType, UserData } from "@/lib/types";
import { createOrGetUser, useSimulation } from "@/lib/websocket";

export default function Home() {
  const { state, connected, sendAction } = useSimulation();
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // ── User state ──────────────────────────────────────────────────────────────
  const [user, setUser] = useState<UserData | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  // Auto-login from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("village_username");
    if (stored) {
      createOrGetUser(stored)
        .then(setUser)
        .catch(() => localStorage.removeItem("village_username"))
        .finally(() => setUserLoading(false));
    } else {
      setUserLoading(false);
    }
  }, []);

  const handleLogin = (u: UserData) => {
    setUser(u);
  };

  // ── Tile interaction ─────────────────────────────────────────────────────────
  const handleTileClick = async (x: number, y: number) => {
    if (!selectedAction) return;
    const result = await sendAction(selectedAction, x, y, user?.username);
    if (result.ok) {
      setFeedback(`${selectedAction} at (${x}, ${y})`);
      // Update local credit balance from response
      if (user && typeof result.credits === "number") {
        setUser({ ...user, credits: result.credits, actions_taken: result.actions_taken });
      }
    } else {
      setFeedback(result.detail ?? result.error ?? "Action failed");
    }
    setTimeout(() => setFeedback(null), 2500);
  };

  // ── Loading splash ───────────────────────────────────────────────────────────
  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl font-bold text-gray-300 mb-4">
            Living Village Simulator
          </div>
          <div className="text-gray-500">
            {connected ? "Loading world..." : "Connecting to server..."}
          </div>
          <div className="mt-4 w-8 h-8 border-4 border-gray-600 border-t-indigo-500 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Login overlay — shown after mount check, only if no user */}
      {!userLoading && !user && <UserLogin onLogin={handleLogin} />}

      <div className="min-h-screen p-4">
        {/* Header */}
        <header className="max-w-7xl mx-auto mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Living Village Simulator
            </h1>
            <p className="text-sm text-gray-400">
              Day {state.dayCount} &middot; Population: {state.population}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <div className="text-right">
                <div className="text-sm font-semibold text-white">{user.username}</div>
                <div className="text-xs text-amber-400">{user.credits} credits &middot; {user.actions_taken} actions</div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  connected ? "bg-green-400" : "bg-red-400"
                }`}
              />
              <span className="text-xs text-gray-400">
                {connected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
        </header>

        {/* Main layout */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Left: Canvas + Controls */}
          <div className="space-y-4">
            <WorldCanvas
              state={state}
              selectedAction={selectedAction}
              onTileClick={handleTileClick}
            />

            {feedback && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-200">
                {feedback}
              </div>
            )}

            <Controls
              selectedAction={selectedAction}
              onSelect={setSelectedAction}
              credits={user?.credits ?? null}
            />
          </div>

          {/* Right: Sidebar + Leaderboard + EventLog */}
          <div className="space-y-4">
            <Sidebar state={state} />
            <Leaderboard currentUsername={user?.username ?? null} />
            <EventLog events={state.events} />
          </div>
        </div>
      </div>
    </>
  );
}
