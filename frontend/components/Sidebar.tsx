"use client";

import type { WorldStateData } from "@/lib/types";

interface Props {
  state: WorldStateData;
}

function getDayPhase(t: number): string {
  if (t < 0.2) return "Night";
  if (t < 0.35) return "Dawn";
  if (t < 0.65) return "Day";
  if (t < 0.8) return "Dusk";
  return "Night";
}

function getWeather(rain: number): { label: string; color: string } {
  if (rain <= 0.02) return { label: "Clear",    color: "#fbbf24" };
  if (rain < 0.25)  return { label: "Drizzle",  color: "#93c5fd" };
  if (rain < 0.55)  return { label: "Rain",     color: "#60a5fa" };
  return              { label: "Downpour", color: "#818cf8" };
}

export default function Sidebar({ state }: Props) {
  const phase   = getDayPhase(state.timeOfDay);
  const rain    = state.rainLevel ?? 0;
  const weather = getWeather(rain);

  return (
    <div className="space-y-4">
      {/* Time */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Time
        </h3>
        <div className="text-2xl font-bold text-white">Day {state.dayCount}</div>
        <div className="text-sm text-gray-300 mt-1">
          {phase} &middot; Tick {state.tick}
        </div>
        {/* Day/night bar */}
        <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${state.timeOfDay * 100}%`,
              background:
                state.timeOfDay > 0.2 && state.timeOfDay < 0.8
                  ? "linear-gradient(to right, #fbbf24, #f59e0b)"
                  : "linear-gradient(to right, #312e81, #4338ca)",
            }}
          />
        </div>
      </div>

      {/* Weather */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Weather
        </h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-base font-bold" style={{ color: weather.color }}>
            {rain <= 0.02 ? "☀" : rain < 0.25 ? "🌦" : rain < 0.55 ? "🌧" : "⛈"}&nbsp;
            {weather.label}
          </span>
          <span className="text-xs text-gray-400">{Math.round(rain * 100)}%</span>
        </div>
        {/* Rain intensity bar */}
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${rain * 100}%`,
              background: "linear-gradient(to right, #93c5fd, #818cf8)",
            }}
          />
        </div>
        {rain > 0.02 && (
          <p className="mt-1 text-xs text-blue-400">
            Fire spread reduced by {Math.round(rain * 85)}%
          </p>
        )}
      </div>

      {/* Population */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Population
        </h3>
        <div className="text-3xl font-bold text-amber-400">{state.population}</div>
        {state.villagers.length > 0 && (
          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
            {state.villagers.map((v) => (
              <div key={v.id} className="flex items-center justify-between text-xs gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  {/* Role badge */}
                  <span
                    className={`shrink-0 px-1 rounded text-[10px] font-bold uppercase ${
                      v.role === "farmer"
                        ? "bg-lime-900 text-lime-300"
                        : "bg-sky-900 text-sky-300"
                    }`}
                  >
                    {v.role === "farmer" ? "F" : "B"}
                  </span>
                  <span className="text-gray-300 truncate">{v.name}</span>
                </div>
                <span className="flex gap-2 shrink-0">
                  <span
                    className={
                      v.health < 30
                        ? "text-red-400"
                        : v.health < 60
                          ? "text-yellow-400"
                          : "text-green-400"
                    }
                  >
                    HP {Math.round(v.health)}
                  </span>
                  <span className="text-orange-300">
                    HG {Math.round(v.hunger)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resources */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Resources
        </h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xl font-bold text-yellow-400">
              {state.resources.food}
            </div>
            <div className="text-xs text-gray-400">Food</div>
          </div>
          <div>
            <div className="text-xl font-bold text-amber-600">
              {state.resources.wood}
            </div>
            <div className="text-xs text-gray-400">Wood</div>
          </div>
          <div>
            <div className="text-xl font-bold text-blue-400">
              {state.resources.water}
            </div>
            <div className="text-xs text-gray-400">Water</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Legend
        </h3>
        <div className="grid grid-cols-2 gap-1 text-xs">
          {[
            { color: "#6abe45", label: "Grass" },
            { color: "#2d6a1e", label: "Tree" },
            { color: "#c9a227", label: "Farm" },
            { color: "#8b7355", label: "House" },
            { color: "#5b9bd5", label: "Well" },
            { color: "#4a90d9", label: "Water" },
            { color: "#84cc16", label: "Farmer" },
            { color: "#38bdf8", label: "Builder" },
            { color: "#f97316", label: "Working" },
            { color: "#22c55e", label: "Eating" },
            { color: "#ef4444", label: "Danger/Fire" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-sm inline-block"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-gray-300">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
