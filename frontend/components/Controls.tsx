"use client";

import type { ActionType } from "@/lib/types";

interface Props {
  selectedAction: ActionType | null;
  onSelect: (action: ActionType | null) => void;
}

const ACTIONS: { type: ActionType; label: string; icon: string; description: string }[] = [
  {
    type: "spawn_tree",
    label: "Plant Tree",
    icon: "T",
    description: "Costs 5 wood. Click a grass tile.",
  },
  {
    type: "build_house",
    label: "Build House",
    icon: "H",
    description: "Costs 15 wood. Click a grass tile.",
  },
  {
    type: "trigger_fire",
    label: "Start Fire",
    icon: "F",
    description: "Ignite a tile. Click to target.",
  },
  {
    type: "trigger_rain",
    label: "Trigger Rain",
    icon: "R",
    description: "Extinguish fires in an area.",
  },
];

export default function Controls({ selectedAction, onSelect }: Props) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Actions
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map((action) => {
          const active = selectedAction === action.type;
          return (
            <button
              key={action.type}
              onClick={() => onSelect(active ? null : action.type)}
              className={`
                px-3 py-2 rounded-md text-sm font-medium transition-all
                border text-left
                ${
                  active
                    ? "bg-indigo-600 border-indigo-400 text-white"
                    : "bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
                }
              `}
              title={action.description}
            >
              <span className="font-mono mr-1">[{action.icon}]</span>
              {action.label}
            </button>
          );
        })}
      </div>
      {selectedAction && (
        <p className="mt-2 text-xs text-gray-400">
          {ACTIONS.find((a) => a.type === selectedAction)?.description} Click on
          the map to apply.
        </p>
      )}
    </div>
  );
}
