"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorldStateData } from "@/lib/types";

const GRID = 50;
const CELL = 12;
const SIZE = GRID * CELL;

const TILE_COLORS: Record<string, string> = {
  grass: "#6abe45",
  water: "#4a90d9",
  tree: "#2d6a1e",
  farm: "#c9a227",
  house: "#8b7355",
  well: "#5b9bd5",
};

interface Props {
  state: WorldStateData;
  selectedAction: string | null;
  onTileClick: (x: number, y: number) => void;
}

export default function WorldCanvas({ state, selectedAction, onTileClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Draw grid tiles
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const tileType = state.grid[y]?.[x] ?? "grass";
        ctx.fillStyle = TILE_COLORS[tileType] ?? "#6abe45";
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);

        // Fire overlay
        if (state.fires[y]?.[x]) {
          ctx.fillStyle = "rgba(255, 60, 20, 0.7)";
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
          // Fire flicker
          ctx.fillStyle = "rgba(255, 200, 0, 0.5)";
          ctx.fillRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
        }
      }
    }

    // Grid lines (subtle)
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(SIZE, i * CELL);
      ctx.stroke();
    }

    // Draw villagers
    for (const v of state.villagers) {
      const cx = v.x * CELL + CELL / 2;
      const cy = v.y * CELL + CELL / 2;

      // Drop shadow
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2.5, 4.5, 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Role ring (outer circle) — farmer = lime, builder = sky
      const ringColor = v.role === "farmer" ? "#84cc16" : "#38bdf8";
      ctx.fillStyle = ringColor;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();

      // State fill (inner circle)
      let fillColor = "#fafafa"; // idle
      if (v.state === "moving") fillColor = "#fbbf24";   // amber
      if (v.state === "eating") fillColor = "#22c55e";   // green
      if (v.state === "working") fillColor = "#f97316";  // orange
      if (v.health < 30) fillColor = "#ef4444";           // danger red

      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();

      // Crisp outline
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Day/night overlay
    const tod = state.timeOfDay;
    let nightAlpha = 0;
    if (tod < 0.2 || tod > 0.8) {
      // Night time
      nightAlpha = tod < 0.2 ? 0.3 * (1 - tod / 0.2) : 0.3 * ((tod - 0.8) / 0.2);
    }
    if (nightAlpha > 0) {
      ctx.fillStyle = `rgba(10, 10, 50, ${nightAlpha})`;
      ctx.fillRect(0, 0, SIZE, SIZE);
    }

    // Hover highlight
    if (hoverTile && selectedAction) {
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(hoverTile.x * CELL, hoverTile.y * CELL, CELL, CELL);
    }
  }, [state, hoverTile, selectedAction]);

  useEffect(() => {
    draw();
  }, [draw]);

  const getTile = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = SIZE / rect.width;
    const scaleY = SIZE / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX / CELL);
    const y = Math.floor((e.clientY - rect.top) * scaleY / CELL);
    return { x: Math.max(0, Math.min(GRID - 1, x)), y: Math.max(0, Math.min(GRID - 1, y)) };
  };

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      className="border border-gray-700 rounded-lg cursor-crosshair"
      style={{ imageRendering: "pixelated", width: "100%", maxWidth: SIZE }}
      onClick={(e) => {
        const { x, y } = getTile(e);
        onTileClick(x, y);
      }}
      onMouseMove={(e) => {
        const tile = getTile(e);
        setHoverTile(tile);
      }}
      onMouseLeave={() => setHoverTile(null)}
    />
  );
}
