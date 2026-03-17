"use client";

import type { ActionType } from "@/lib/types";
import { ACTION_COSTS } from "@/lib/types";

interface Props {
  selectedAction: ActionType | null;
  onSelect: (action: ActionType | null) => void;
  credits: number | null;         // null = no user logged in (no limit enforced)
}

const ACTIONS: { type: ActionType; label: string; icon: string; desc: string }[] = [
  { type: "spawn_tree",   label: "Plant Tree",    icon: "T", desc: "Grass tile only" },
  { type: "build_house",  label: "Build House",   icon: "H", desc: "Grass tile, costs 15 wood" },
  { type: "trigger_fire", label: "Start Fire",    icon: "F", desc: "Any non-water tile" },
  { type: "trigger_rain", label: "Trigger Rain",  icon: "R", desc: "Extinguishes nearby fires" },
];

export default function Controls({ selectedAction, onSelect, credits }: Props) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Actions
        </h3>
        {credits !== null && (
          <span className={`text-xs font-semibold ${credits < 10 ? "text-red-400" : "text-amber-400"}`}>
            {credits} cr
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map((action) => {
          const cost = ACTION_COSTS[action.type];
          const canAfford = credits === null || credits >= cost;
          const active = selectedAction === action.type;
          return (
            <button
              key={action.type}
              onClick={() => canAfford && onSelect(active ? null : action.type)}
              disabled={!canAfford}
              className={`
                px-3 py-2 rounded-md text-sm font-medium transition-all
                border text-left
                ${
                  !canAfford
                    ? "bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed"
                    : active
                    ? "bg-indigo-600 border-indigo-400 text-white"
                    : "bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
                }
              `}
              title={canAfford ? action.desc : `Need ${cost} credits`}
            >
              <div className="flex items-center justify-between gap-1">
                <span>
                  <span className="font-mono mr-1">[{action.icon}]</span>
                  {action.label}
                </span>
                <span className={`text-[10px] shrink-0 ${canAfford ? "text-amber-400/70" : "text-gray-600"}`}>
                  {cost} cr
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedAction && (
        <p className="mt-2 text-xs text-gray-400">
          {ACTIONS.find((a) => a.type === selectedAction)?.desc} — click the map to apply.
        </p>
      )}

      {credits !== null && credits === 0 && (
        <p className="mt-2 text-xs text-red-400">Out of credits.</p>
      )}
    </div>
  );
}
