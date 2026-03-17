"""World events: fire with per-tile flammability, rain level, disease."""

from __future__ import annotations

import random
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.simulation.world import WorldState

from app.simulation.world import TileType

# ─────────────────────────────────────────────────────────────────────────────
# Per-tile fire properties
# spread_prob : probability this burning tile ignites each adjacent non-fire tile per tick
# burn_rate   : durability points lost per tick while burning
# ─────────────────────────────────────────────────────────────────────────────

FIRE_PROPS: dict[TileType, dict[str, float]] = {
    TileType.TREE:  {"spread_prob": 0.22, "burn_rate": 6.5},  # Dense fuel — spreads fast, burns hot
    TileType.FARM:  {"spread_prob": 0.12, "burn_rate": 3.0},  # Dry crops — moderate spread
    TileType.GRASS: {"spread_prob": 0.09, "burn_rate": 4.5},  # Spreads readily, burns out quickly
    TileType.HOUSE: {"spread_prob": 0.07, "burn_rate": 1.8},  # Structural timber — slow, thorough
    TileType.WELL:  {"spread_prob": 0.02, "burn_rate": 0.5},  # Stone/water — barely burns
    TileType.WATER: {"spread_prob": 0.00, "burn_rate": 0.0},  # Fireproof
}

_DEFAULT_PROPS: dict[str, float] = {"spread_prob": 0.07, "burn_rate": 2.0}


def maybe_trigger_random_events(world: WorldState) -> None:
    """Small per-tick chance of random world events."""
    if random.random() < 0.004:
        _start_random_fire(world)
    if random.random() < 0.003:
        _random_rain(world)
    if random.random() < 0.002:
        _disease_outbreak(world)


# ─────────────────────────────────────────────────────────────────────────────
# Fire
# ─────────────────────────────────────────────────────────────────────────────

def _start_random_fire(world: WorldState) -> None:
    for _ in range(20):
        x = random.randint(0, world.width - 1)
        y = random.randint(0, world.height - 1)
        tile = world.grid[y][x]
        if tile.type != TileType.WATER and not tile.on_fire:
            tile.on_fire = True
            world.add_event("fire", f"Fire broke out at ({x}, {y})")
            return


def spread_fire(world: WorldState) -> None:
    """Spread fire with per-tile probabilities, rain dampening, and type-aware burn rates."""
    # Rain reduces both spread probability (strongly) and burn damage (moderately)
    rain_spread_mod = max(0.0, 1.0 - world.rain_level * 0.85)
    rain_burn_mod   = max(0.0, 1.0 - world.rain_level * 0.60)

    new_fires: list[tuple[int, int]] = []

    for y in range(world.height):
        for x in range(world.width):
            tile = world.grid[y][x]
            if not tile.on_fire:
                continue

            src_props = FIRE_PROPS.get(tile.type, _DEFAULT_PROPS)
            # Source emission × rain modifier
            base_prob = src_props["spread_prob"] * rain_spread_mod

            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if not world.in_bounds(nx, ny):
                    continue
                neighbour = world.grid[ny][nx]
                if neighbour.on_fire or neighbour.type == TileType.WATER:
                    continue
                # Scale probability by target flammability relative to default
                n_props = FIRE_PROPS.get(neighbour.type, _DEFAULT_PROPS)
                prob = base_prob * (n_props["spread_prob"] / 0.10)
                if random.random() < prob:
                    new_fires.append((nx, ny))

    for fx, fy in new_fires:
        world.grid[fy][fx].on_fire = True

    # Burn: each on-fire tile loses durability at its tile-specific rate
    for y in range(world.height):
        for x in range(world.width):
            tile = world.grid[y][x]
            if tile.on_fire:
                props = FIRE_PROPS.get(tile.type, _DEFAULT_PROPS)
                tile.durability -= props["burn_rate"] * rain_burn_mod
                if tile.durability <= 0:
                    tile.type = TileType.GRASS
                    tile.on_fire = False
                    tile.durability = 100.0


# ─────────────────────────────────────────────────────────────────────────────
# Rain
# ─────────────────────────────────────────────────────────────────────────────

def _random_rain(world: WorldState) -> None:
    cx = random.randint(0, world.width - 1)
    cy = random.randint(0, world.height - 1)
    apply_rain(world, cx, cy)


def apply_rain(world: WorldState, cx: int, cy: int, radius: int = 5, triggered_by: str | None = None) -> None:
    """Raise world rain level and immediately extinguish fires in the area."""
    world.rain_level = min(1.0, world.rain_level + 0.7)
    extinguished = 0
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            nx, ny = cx + dx, cy + dy
            if world.in_bounds(nx, ny) and world.grid[ny][nx].on_fire:
                world.grid[ny][nx].on_fire = False
                extinguished += 1
    who = f" by {triggered_by}" if triggered_by else ""
    if extinguished:
        world.add_event("rain", f"Rain at ({cx}, {cy}){who} extinguished {extinguished} fire{'' if extinguished == 1 else 's'}", triggered_by=triggered_by)
    else:
        world.add_event("rain", f"Rain fell near ({cx}, {cy}){who}", triggered_by=triggered_by)


# ─────────────────────────────────────────────────────────────────────────────
# Disease
# ─────────────────────────────────────────────────────────────────────────────

def _disease_outbreak(world: WorldState) -> None:
    living = world.living_villagers()
    if not living:
        return
    affected = random.sample(living, k=min(len(living), random.randint(1, 3)))
    for v in affected:
        v.health = max(0.0, v.health - random.uniform(8.0, 20.0))
    world.add_event("disease", f"Disease struck: {', '.join(v.name for v in affected)}")


# ─────────────────────────────────────────────────────────────────────────────
# User-triggered
# ─────────────────────────────────────────────────────────────────────────────

def trigger_fire_at(world: WorldState, x: int, y: int, triggered_by: str | None = None) -> bool:
    if not world.in_bounds(x, y):
        return False
    tile = world.grid[y][x]
    if tile.type == TileType.WATER or tile.on_fire:
        return False
    tile.on_fire = True
    who = f" by {triggered_by}" if triggered_by else " by player"
    world.add_event("fire", f"Fire started at ({x}, {y}){who}", triggered_by=triggered_by)
    return True
