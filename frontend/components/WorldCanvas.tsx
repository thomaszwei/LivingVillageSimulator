"use client";

import { useEffect, useRef, useState } from "react";
import type { WorldStateData } from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────
const GRID = 50;
const CELL = 12;
const SIZE = GRID * CELL;

const TILE_COLORS: Record<string, string> = {
  grass: "#6abe45",
  water: "#4a90d9",
  tree:  "#2d6a1e",
  farm:  "#c9a227",
  house: "#8b7355",
  well:  "#5b9bd5",
};

// Faster flicker = hotter fire (rad/ms)
const FIRE_FLICKER: Record<string, number> = {
  tree:  0.019,
  grass: 0.013,
  farm:  0.009,
  house: 0.006,
  well:  0.004,
};

// Hover fill hints by action
const ACTION_FILL: Record<string, string> = {
  spawn_tree:   "rgba(80, 210, 40, 0.18)",
  build_house:  "rgba(180, 140, 70, 0.18)",
  trigger_fire: "rgba(255, 55, 15, 0.22)",
  trigger_rain: "rgba(70, 155, 255, 0.22)",
};

// ── Particle types ────────────────────────────────────────────────────────────
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
  decay: number;
  radius: number;
  grow: number;
  isEmber: boolean;
}

interface RainDrop {
  x: number;
  y: number;
  speed: number;
  len: number;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  state: WorldStateData;
  selectedAction: string | null;
  onTileClick: (x: number, y: number) => void;
  displayMode?: boolean;
}

export default function WorldCanvas({ state, selectedAction, onTileClick, displayMode = false }: Props) {
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  // Refs mirror latest prop/state values so the RAF loop never needs a restart
  const stateRef        = useRef(state);
  const actionRef       = useRef(selectedAction);
  const hoverRef        = useRef<{ x: number; y: number } | null>(null);
  const particlesRef    = useRef<Particle[]>([]);
  const rainDropsRef    = useRef<RainDrop[]>([]);
  const lastSpawnRef    = useRef(0);
  const lastFrameRef    = useRef(0); // for display mode FPS cap

  const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => { stateRef.current = state; },          [state]);
  useEffect(() => { actionRef.current = selectedAction; }, [selectedAction]);
  useEffect(() => { hoverRef.current = hoverTile; },       [hoverTile]);

  // ── Single RAF loop (runs for lifetime of the component) ─────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Non-null assertion: a regular <canvas> always yields a 2D context.
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

    let animId: number;

    function animate(ts: number) {
      // Display mode: cap to ~30 fps to reduce CPU/GPU load
      if (displayMode && ts - lastFrameRef.current < 33) {
        animId = requestAnimationFrame(animate);
        return;
      }
      lastFrameRef.current = ts;

      const s   = stateRef.current;
      const pts = particlesRef.current;
      const rds = rainDropsRef.current;

      // ── Spawn ──────────────────────────────────────────────────────────────
      if (ts - lastSpawnRef.current > 55) {
        lastSpawnRef.current = ts;

        const spawnChance = displayMode ? 0.12 : 0.28;

        for (let ry = 0; ry < GRID; ry++) {
          for (let rx = 0; rx < GRID; rx++) {
            if (!s.fires[ry]?.[rx]) continue;
            if (Math.random() > spawnChance) continue;

            const tileType = s.grid[ry]?.[rx] ?? "grass";
            const cx = rx * CELL + CELL / 2 + (Math.random() - 0.5) * CELL * 0.7;
            const cy = ry * CELL + CELL / 2;

            // Smoke puff
            pts.push({
              x: cx, y: cy,
              vx: (Math.random() - 0.5) * 0.65,
              vy: -(0.65 + Math.random() * 0.75),
              opacity: 0.38 + Math.random() * 0.22,
              decay:   0.005 + Math.random() * 0.004,
              radius:  1.8 + Math.random() * 1.8,
              grow:    0.032 + Math.random() * 0.022,
              isEmber: false,
            });

            // Embers — only from trees, skipped in display mode
            if (!displayMode && tileType === "tree" && Math.random() < 0.28) {
              pts.push({
                x: cx, y: cy - 1,
                vx: (Math.random() - 0.5) * 2.2,
                vy: -(1.6 + Math.random() * 2.2),
                opacity: 1.0,
                decay:   0.020 + Math.random() * 0.012,
                radius:  0.8 + Math.random() * 0.7,
                grow:    0.004,
                isEmber: true,
              });
            }
          }
        }

        // Rain drops enter from the top
        const rainLevel = s.rainLevel ?? 0;
        if (rainLevel > 0) {
          const n = Math.ceil(rainLevel * (displayMode ? 6 : 12));
          for (let i = 0; i < n; i++) {
            rds.push({
              x: Math.random() * (SIZE + 50) - 20,
              y: -16,
              speed: 6.5 + Math.random() * 5,
              len:   8 + Math.random() * 8,
            });
          }
        }
      }

      // ── Update ────────────────────────────────────────────────────────────
      const maxParticles = displayMode ? 80  : 380;
      const trimParticles = displayMode ? 60  : 320;
      const maxRain      = displayMode ? 120 : 520;
      const trimRain     = displayMode ? 80  : 440;

      particlesRef.current = pts
        .map((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.opacity -= p.decay;
          p.radius += p.grow;
          if (!p.isEmber) p.vx += (Math.random() - 0.5) * 0.04; // smoke drifts
          return p;
        })
        .filter((p) => p.opacity > 0.01);
      if (particlesRef.current.length > maxParticles) particlesRef.current = particlesRef.current.slice(-trimParticles);

      rainDropsRef.current = rds
        .map((d) => { d.x -= 1.8; d.y += d.speed; return d; })
        .filter((d) => d.y < SIZE + 20);
      if (rainDropsRef.current.length > maxRain) rainDropsRef.current = rainDropsRef.current.slice(-trimRain);

      // ── Draw ──────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, SIZE, SIZE);

      // 1. Tile base colours
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          const t = s.grid[y]?.[x] ?? "grass";
          ctx.fillStyle = TILE_COLORS[t] ?? "#6abe45";
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }

      // 2. Animated fire overlays (per-tile flicker, type-aware brightness)
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          if (!s.fires[y]?.[x]) continue;
          const tileType = s.grid[y]?.[x] ?? "grass";
          const spd   = FIRE_FLICKER[tileType] ?? 0.010;
          const phase = x * 1.31 + y * 0.87;
          const t     = 0.5 + 0.5 * Math.sin(ts * spd + phase);       // 0–1

          if (displayMode) {
            // Simplified: single orange-red pass — much cheaper
            const fireAlpha = 0.55 + t * 0.25;
            const rr = 215 + Math.round(t * 40);
            const gg = Math.round(t * 50);
            ctx.fillStyle = `rgba(${rr}, ${gg}, 15, ${fireAlpha})`;
            ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
          } else {
            // Full quality: char base + fire body + hot core
            ctx.fillStyle = "rgba(20, 8, 0, 0.40)";
            ctx.fillRect(x * CELL, y * CELL, CELL, CELL);

            const fireAlpha = 0.52 + t * 0.28;
            const rr = 215 + Math.round(t * 40);
            const gg = Math.round(t * (tileType === "tree" ? 80 : 55));
            ctx.fillStyle = `rgba(${rr}, ${gg}, 15, ${fireAlpha})`;
            ctx.fillRect(x * CELL, y * CELL, CELL, CELL);

            if (tileType === "tree") {
              ctx.fillStyle = `rgba(255, 240, 80, ${0.45 + t * 0.35})`;
              ctx.fillRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
              ctx.fillStyle = `rgba(255, 255, 200, ${0.20 + t * 0.25})`;
              ctx.fillRect(x * CELL + 4, y * CELL + 4, CELL - 8, CELL - 8);
            } else {
              ctx.fillStyle = `rgba(255, 150, 30, ${0.28 + t * 0.22})`;
              ctx.fillRect(x * CELL + 3, y * CELL + 3, CELL - 6, CELL - 6);
            }
          }
        }
      }

      // 3. Grid lines — skipped in display mode
      if (!displayMode) {
        ctx.strokeStyle = "rgba(0,0,0,0.07)";
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= GRID; i++) {
          ctx.beginPath(); ctx.moveTo(i * CELL, 0);    ctx.lineTo(i * CELL, SIZE); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, i * CELL);    ctx.lineTo(SIZE, i * CELL); ctx.stroke();
        }
      }

      // 4. Villagers
      for (const v of s.villagers) {
        const cx = v.x * CELL + CELL / 2;
        const cy = v.y * CELL + CELL / 2;
        // Shadow — skipped in display mode
        if (!displayMode) {
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.beginPath();
          ctx.ellipse(cx, cy + 2.5, 4.5, 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        // Role ring
        ctx.fillStyle = v.role === "farmer" ? "#84cc16" : "#38bdf8";
        ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
        // State dot
        let fill = "#fafafa";
        if (v.state === "moving")  fill = "#fbbf24";
        if (v.state === "eating")  fill = "#22c55e";
        if (v.state === "working") fill = "#f97316";
        if (v.health < 30)         fill = "#ef4444";
        ctx.fillStyle = fill;
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
        // Outline
        ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.stroke();
      }

      // 5. Night overlay
      const tod = s.timeOfDay;
      let nightAlpha = 0;
      if (tod < 0.2 || tod > 0.8) {
        nightAlpha = tod < 0.2
          ? 0.32 * (1 - tod / 0.2)
          : 0.32 * ((tod - 0.8) / 0.2);
      }
      if (nightAlpha > 0) {
        ctx.fillStyle = `rgba(10, 10, 55, ${nightAlpha})`;
        ctx.fillRect(0, 0, SIZE, SIZE);
      }

      // 6. Smoke particles
      for (const p of particlesRef.current) {
        if (p.isEmber) {
          // Ember glow + bright core
          ctx.globalAlpha = p.opacity * 0.35;
          ctx.fillStyle = "#ffaa22";
          ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 2, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = p.opacity;
          ctx.fillStyle = "#ffcc44";
          ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
        } else {
          // Two-layer smoke puff: lighter outer, darker inner
          ctx.globalAlpha = p.opacity * 0.55;
          ctx.fillStyle = "#a09488";
          ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = p.opacity * 0.30;
          ctx.fillStyle = "#5e524b";
          ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * 0.55, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // 7. Rain streaks + world tint
      const rainLevel = s.rainLevel ?? 0;
      if (rainLevel > 0) {
        const dropAlpha = 0.18 + rainLevel * 0.28;
        ctx.strokeStyle = `rgba(180, 215, 255, ${dropAlpha})`;
        ctx.lineWidth = 1;
        for (const d of rainDropsRef.current) {
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - 2.2, d.y + d.len); // slight diagonal = wind-driven rain
          ctx.stroke();
        }
        // Subtle blue-grey world tint
        ctx.fillStyle = `rgba(60, 100, 180, ${rainLevel * 0.055})`;
        ctx.fillRect(0, 0, SIZE, SIZE);
      }

      // 8. Hover highlight — skipped in display mode (no mouse interaction)
      if (!displayMode) {
        const hover  = hoverRef.current;
        const action = actionRef.current;
        if (hover && action) {
          const hint = ACTION_FILL[action];
          if (hint) {
            ctx.fillStyle = hint;
            ctx.fillRect(hover.x * CELL, hover.y * CELL, CELL, CELL);
          }
          ctx.strokeStyle = "rgba(255,255,255,0.88)";
          ctx.lineWidth = 2;
          ctx.strokeRect(hover.x * CELL, hover.y * CELL, CELL, CELL);
        }
      }

      animId = requestAnimationFrame(animate);
    }

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [displayMode]); // displayMode changes style/perf but not the loop lifetime

  // ── Mouse helpers ─────────────────────────────────────────────────────────
  const getTile = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(GRID - 1, Math.floor((e.clientX - rect.left) * (SIZE / rect.width)  / CELL))),
      y: Math.max(0, Math.min(GRID - 1, Math.floor((e.clientY - rect.top)  * (SIZE / rect.height) / CELL))),
    };
  };

  if (displayMode) {
    return (
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        style={{ imageRendering: "pixelated", width: "min(100vw, 100vh)", height: "min(100vw, 100vh)" }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      className="border border-gray-700 rounded-lg cursor-crosshair"
      style={{ imageRendering: "pixelated", width: "100%", maxWidth: SIZE }}
      onClick={(e) => { const { x, y } = getTile(e); onTileClick(x, y); }}
      onMouseMove={(e) => { setHoverTile(getTile(e)); }}
      onMouseLeave={() => setHoverTile(null)}
    />
  );
}
