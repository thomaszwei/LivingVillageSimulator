"use client";

import type { GameEventData } from "@/lib/types";

interface Props {
  events: GameEventData[];
}

const EVENT_COLORS: Record<string, string> = {
  fire: "text-red-400",
  rain: "text-blue-400",
  disease: "text-purple-400",
  death: "text-gray-400",
  day: "text-yellow-300",
  build: "text-green-400",
};

export default function EventLog({ events }: Props) {
  const reversed = [...events].reverse();
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Event Log
      </h3>
      <div className="space-y-1 max-h-48 overflow-y-auto text-xs font-mono">
        {reversed.length === 0 && (
          <p className="text-gray-500 italic">No events yet...</p>
        )}
        {reversed.map((ev, i) => (
          <div key={`${ev.tick}-${i}`} className="flex gap-2">
            <span className="text-gray-500 w-12 shrink-0 text-right">
              #{ev.tick}
            </span>
            <span className={EVENT_COLORS[ev.type] ?? "text-gray-300"}>
              {ev.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
