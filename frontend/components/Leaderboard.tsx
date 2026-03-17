"use client";

import { useEffect, useState } from "react";
import type { LeaderboardEntry } from "@/lib/types";
import { fetchLeaderboard } from "@/lib/websocket";

interface Props {
  currentUsername: string | null;
}

export default function Leaderboard({ currentUsername }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchLeaderboard();
        if (!cancelled) {
          setEntries(data);
          setLastUpdated(Date.now());
        }
      } catch {
        // silent failure — will retry
      }
    };

    load();
    const timer = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const medalColor = (rank: number) =>
    rank === 1 ? "text-yellow-400" : rank === 2 ? "text-gray-300" : rank === 3 ? "text-amber-600" : "text-gray-500";

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Leaderboard
        </h3>
        {lastUpdated > 0 && (
          <span className="text-[10px] text-gray-600">
            updated {Math.round((Date.now() - lastUpdated) / 1000)}s ago
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-2">No players yet</p>
      ) : (
        <div className="space-y-1">
          {entries.map((e) => {
            const isMe = e.username === currentUsername;
            return (
              <div
                key={e.username}
                className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${
                  isMe ? "bg-indigo-900/40 border border-indigo-700/50" : ""
                }`}
              >
                {/* Rank */}
                <span className={`w-5 font-bold shrink-0 ${medalColor(e.rank)}`}>
                  {e.rank <= 3 ? ["", "#1", "#2", "#3"][e.rank] : `#${e.rank}`}
                </span>

                {/* Username */}
                <span
                  className={`flex-1 truncate ${isMe ? "text-indigo-300 font-semibold" : "text-gray-300"}`}
                >
                  {e.username}
                  {isMe && <span className="ml-1 text-indigo-500">(you)</span>}
                </span>

                {/* Actions */}
                <span className="text-gray-400 shrink-0" title="actions taken">
                  {e.actions_taken}
                  <span className="text-gray-600 ml-0.5">act</span>
                </span>

                {/* Credits */}
                <span className="text-amber-400 font-semibold shrink-0 w-14 text-right">
                  {e.credits} cr
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
