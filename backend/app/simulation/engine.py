"""Simulation engine — tick loop and villager physics."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Callable, Coroutine

from app.config import DAY_LENGTH_TICKS, PERSIST_EVERY, TICK_INTERVAL, WS_BROADCAST_EVERY
from app.simulation.ai import VILLAGER_BT
from app.simulation.events import maybe_trigger_random_events, spread_fire
from app.simulation.world import TileType, Villager, VillagerState, WorldState

logger = logging.getLogger("simulation")


class SimulationEngine:
    """Manages the simulation loop and world state."""

    def __init__(self) -> None:
        self.world = WorldState()
        self.world.initialize()
        self._running = False
        self._task: asyncio.Task[None] | None = None
        self._broadcast_cb: Callable[[dict[str, Any]], Coroutine[Any, Any, None]] | None = None
        self._persist_cb: Callable[[WorldState], Coroutine[Any, Any, None]] | None = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info("Simulation started")

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Simulation stopped")

    def set_broadcast_callback(
        self, cb: Callable[[dict[str, Any]], Coroutine[Any, Any, None]]
    ) -> None:
        self._broadcast_cb = cb

    def set_persist_callback(
        self, cb: Callable[[WorldState], Coroutine[Any, Any, None]]
    ) -> None:
        self._persist_cb = cb

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    async def _loop(self) -> None:
        while self._running:
            try:
                self._tick()

                if self.world.tick % WS_BROADCAST_EVERY == 0 and self._broadcast_cb:
                    await self._broadcast_cb(self.world.to_dict())

                if self.world.tick % PERSIST_EVERY == 0 and self._persist_cb:
                    await self._persist_cb(self.world)

            except Exception:
                logger.exception("Error during tick %d", self.world.tick)

            await asyncio.sleep(TICK_INTERVAL)

    # ------------------------------------------------------------------
    # Single tick
    # ------------------------------------------------------------------

    def _tick(self) -> None:
        self.world.tick += 1

        # Day / night cycle
        self.world.time_of_day += 1.0 / DAY_LENGTH_TICKS
        if self.world.time_of_day >= 1.0:
            self.world.time_of_day -= 1.0
            self.world.day_count += 1
            self.world.add_event("day", f"Day {self.world.day_count} has begun")

        # Passive resource production
        self._produce_resources()

        # Villager physics then behavior tree
        for v in self.world.villagers:
            if v.is_alive():
                self._update_villager(v)

        # Environmental hazards
        spread_fire(self.world)
        maybe_trigger_random_events(self.world)

    # ------------------------------------------------------------------
    # Resource production (passive, tile-based)
    # ------------------------------------------------------------------

    def _produce_resources(self) -> None:
        w = self.world
        if w.tick % 10 == 0:
            farm_count = sum(
                1 for row in w.grid for t in row
                if t.type == TileType.FARM and not t.on_fire
            )
            w.resources.food += farm_count * 2

        if w.tick % 15 == 0:
            tree_count = sum(
                1 for row in w.grid for t in row
                if t.type == TileType.TREE and not t.on_fire
            )
            w.resources.wood += max(1, tree_count // 3)

        if w.tick % 12 == 0:
            well_count = sum(
                1 for row in w.grid for t in row
                if t.type == TileType.WELL and not t.on_fire
            )
            w.resources.water += well_count * 2

    # ------------------------------------------------------------------
    # Per-villager update: physics first, then behavior tree
    # ------------------------------------------------------------------

    def _update_villager(self, v: Villager) -> None:
        w = self.world

        # ── Biological processes ───────────────────────────────────────
        v.age += 1.0 / DAY_LENGTH_TICKS
        v.hunger = min(100.0, v.hunger + 0.15)

        # Passive health regen when well-fed
        if v.hunger < 30.0 and v.health < 100.0:
            v.health = min(100.0, v.health + 0.08)

        # Starvation damage
        if v.hunger >= 80.0:
            v.health -= 1.5
        if v.hunger >= 95.0:
            v.health -= 1.0

        # Old-age decline
        if v.age > 75.0:
            v.health -= 0.3

        # Fire tile damage
        if w.in_bounds(v.x, v.y) and w.grid[v.y][v.x].on_fire:
            v.health -= 5.0

        # ── Death check ────────────────────────────────────────────────
        if v.health <= 0.0:
            v.state = VillagerState.DEAD
            v.health = 0.0
            v.path = []
            v.path_target = None
            w.add_event("death", f"{v.name} (age {v.age:.0f}) has died")
            return

        # ── Behavior tree decides what to do ──────────────────────────
        VILLAGER_BT.tick(v, w)

    # ------------------------------------------------------------------
    # User-triggered actions (called from API routes)
    # ------------------------------------------------------------------

    def handle_action(self, action_type: str, x: int, y: int) -> dict[str, Any]:
        w = self.world
        if not w.in_bounds(x, y):
            return {"ok": False, "error": "Out of bounds"}

        if action_type == "spawn_tree":
            tile = w.grid[y][x]
            if tile.type != TileType.GRASS:
                return {"ok": False, "error": "Tile is not grass"}
            if w.resources.wood < 5:
                return {"ok": False, "error": "Not enough wood (need 5)"}
            w.resources.wood -= 5
            tile.type = TileType.TREE
            tile.durability = 100.0
            w.add_event("build", f"Tree planted at ({x}, {y})")
            return {"ok": True}

        if action_type == "build_house":
            tile = w.grid[y][x]
            if tile.type != TileType.GRASS:
                return {"ok": False, "error": "Tile is not grass"}
            if w.resources.wood < 15:
                return {"ok": False, "error": "Not enough wood (need 15)"}
            w.resources.wood -= 15
            tile.type = TileType.HOUSE
            tile.durability = 100.0
            w.add_event("build", f"House built at ({x}, {y})")
            return {"ok": True}

        if action_type == "trigger_fire":
            from app.simulation.events import trigger_fire_at

            ok = trigger_fire_at(w, x, y)
            return {"ok": ok, "error": None if ok else "Cannot ignite this tile"}

        if action_type == "trigger_rain":
            from app.simulation.events import apply_rain

            apply_rain(w, x, y)
            return {"ok": True}

        return {"ok": False, "error": f"Unknown action: {action_type}"}
