"""Random world events: fire, rain, disease."""

from __future__ import annotations

import random
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.simulation.world import WorldState

from app.simulation.world import TileType


def maybe_trigger_random_events(world: WorldState) -> None:
    """Called once per tick.  Small probability of random events."""
    if random.random() < 0.004:
        _start_random_fire(world)
    if random.random() < 0.003:
        _random_rain(world)
    if random.random() < 0.002:
        _disease_outbreak(world)


# ------------------------------------------------------------------
# Fire
# ------------------------------------------------------------------

def _start_random_fire(world: WorldState) -> None:
    """Ignite a random non-water tile."""
    for _ in range(20):
        x = random.randint(0, world.width - 1)
        y = random.randint(0, world.height - 1)
        tile = world.grid[y][x]
        if tile.type != TileType.WATER and not tile.on_fire:
            tile.on_fire = True
            world.add_event("fire", f"Fire broke out at ({x}, {y})")
            return


def spread_fire(world: WorldState) -> None:
    """Spread existing fires to adjacent tiles with probability."""
    new_fires: list[tuple[int, int]] = []
    for y in range(world.height):
        for x in range(world.width):
            if world.grid[y][x].on_fire:
                for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    nx, ny = x + dx, y + dy
                    if world.in_bounds(nx, ny):
                        neighbour = world.grid[ny][nx]
                        if (
                            not neighbour.on_fire
                            and neighbour.type != TileType.WATER
                            and random.random() < 0.08
                        ):
                            new_fires.append((nx, ny))
    for fx, fy in new_fires:
        world.grid[fy][fx].on_fire = True

    # Fire damages tiles
    for y in range(world.height):
        for x in range(world.width):
            tile = world.grid[y][x]
            if tile.on_fire:
                tile.durability -= 2.0
                if tile.durability <= 0:
                    tile.type = TileType.GRASS
                    tile.on_fire = False
                    tile.durability = 100.0


# ------------------------------------------------------------------
# Rain
# ------------------------------------------------------------------

def _random_rain(world: WorldState) -> None:
    """Rain over a random area, extinguishing fire."""
    cx = random.randint(0, world.width - 1)
    cy = random.randint(0, world.height - 1)
    apply_rain(world, cx, cy)


def apply_rain(world: WorldState, cx: int, cy: int, radius: int = 5) -> None:
    """Extinguish fire in a square area centered on (cx, cy)."""
    extinguished = 0
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            nx, ny = cx + dx, cy + dy
            if world.in_bounds(nx, ny) and world.grid[ny][nx].on_fire:
                world.grid[ny][nx].on_fire = False
                extinguished += 1
    if extinguished > 0:
        world.add_event("rain", f"Rain at ({cx}, {cy}) extinguished {extinguished} fires")
    else:
        world.add_event("rain", f"Rain fell near ({cx}, {cy})")


# ------------------------------------------------------------------
# Disease
# ------------------------------------------------------------------

def _disease_outbreak(world: WorldState) -> None:
    """Reduce health of random villagers."""
    living = world.living_villagers()
    if not living:
        return
    affected = random.sample(living, k=min(len(living), random.randint(1, 3)))
    for v in affected:
        v.health = max(0.0, v.health - random.uniform(8.0, 20.0))
    names = ", ".join(v.name for v in affected)
    world.add_event("disease", f"Disease struck: {names}")


# ------------------------------------------------------------------
# User-triggered
# ------------------------------------------------------------------

def trigger_fire_at(world: WorldState, x: int, y: int) -> bool:
    if not world.in_bounds(x, y):
        return False
    tile = world.grid[y][x]
    if tile.type == TileType.WATER or tile.on_fire:
        return False
    tile.on_fire = True
    world.add_event("fire", f"Fire started at ({x}, {y}) by player")
    return True
