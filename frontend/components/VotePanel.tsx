"use client";

import { useEffect, useRef, useState } from "react";
import type { DisasterType, VoteState } from "@/lib/types";
import { castVote } from "@/lib/websocket";

interface Props {
  vote: VoteState;
  username: string | null;
}

const DISASTERS: { type: DisasterType; icon: string; label: string; color: string }[] = [
  { type: "meteor", icon: "\u2604\uFE0F", label: "Meteor",  color: "#f97316" },
  { type: "plague", icon: "\uD83E\uDDA0",  label: "Plague",  color: "#a855f7" },
  { type: "storm",  icon: "\u26C8\uFE0F",  label: "Storm",   color: "#3b82f6" },
];

export default function VotePanel({ vote, username }: Props) {
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevRound = useRef(vote.round);

  // Reset local vote state when a new round begins
  useEffect(() => {
    if (vote.round !== prevRound.current) {
      prevRound.current = vote.round;
      setVotedFor(null);
      setError(null);
    }
  }, [vote.round]);

  const handleVote = async (disaster: DisasterType) => {
    if (votedFor) return;
    setError(null);
    const result = await castVote(disaster, username ?? undefined);
    if (result.ok) {
      setVotedFor(disaster);
    } else {
      setError(result.error ?? "Vote failed");
    }
  };

  const maxVotes = Math.max(1, ...Object.values(vote.votes));
  const secs = vote.secondsRemaining;
  const urgencyColor = secs <= 10 ? "text-red-400" : secs <= 20 ? "text-amber-400" : "text-gray-300";

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      {/* Header with countdown */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Vote: Next Disaster
        </h3>
        <span className={`text-sm font-mono font-bold ${urgencyColor}`}>
          {secs}s
        </span>
      </div>

      {/* Countdown bar */}
      <div className="w-full h-1.5 bg-gray-700 rounded-full mb-3 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.max(0, (secs / 60) * 100)}%`,
            background: secs <= 10 ? "#ef4444" : secs <= 20 ? "#f59e0b" : "#6366f1",
          }}
        />
      </div>

      {/* Vote buttons */}
      <div className="flex gap-2 mb-3">
        {DISASTERS.map((d) => {
          const count = vote.votes[d.type] ?? 0;
          const isVoted = votedFor === d.type;
          const barWidth = maxVotes > 0 ? (count / maxVotes) * 100 : 0;
          return (
            <button
              key={d.type}
              onClick={() => handleVote(d.type)}
              disabled={!!votedFor}
              className={`
                flex-1 rounded-lg py-2 px-1 text-center transition-all relative overflow-hidden
                border
                ${
                  isVoted
                    ? "border-indigo-400 bg-indigo-900/40"
                    : votedFor
                    ? "border-gray-700 bg-gray-800/60 opacity-50 cursor-not-allowed"
                    : "border-gray-600 bg-gray-700 hover:bg-gray-600 cursor-pointer"
                }
              `}
            >
              {/* Tally bar background */}
              <div
                className="absolute inset-y-0 left-0 opacity-20 transition-all duration-500"
                style={{ width: `${barWidth}%`, background: d.color }}
              />
              <div className="relative">
                <div className="text-base leading-none mb-1">{d.icon}</div>
                <div className="text-[10px] font-semibold text-gray-300">{d.label}</div>
                <div className="text-xs font-bold mt-1" style={{ color: d.color }}>
                  {count}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      {votedFor && (
        <p className="text-xs text-indigo-400">
          Voted for {DISASTERS.find((d) => d.type === votedFor)?.label}
        </p>
      )}

      {/* Last round result */}
      {vote.lastResult && (
        <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-500">
          Last: <span className="text-gray-300 font-semibold">{vote.lastResult.disaster}</span>
          {vote.lastResult.totalVotes > 0 && (
            <span> ({vote.lastResult.votes}/{vote.lastResult.totalVotes} votes)</span>
          )}
        </div>
      )}
    </div>
  );
}
