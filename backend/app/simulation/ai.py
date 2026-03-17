"""Behavior tree system, A* pathfinding, and role-based villager AI."""

from __future__ import annotations

import heapq
import itertools
import random
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:
    from app.simulation.world import Villager, WorldState

from app.simulation.world import JobRole, TileType, VillagerState

# ─────────────────────────────────────────────────────────────────────────────
# Behavior Tree Core
# ─────────────────────────────────────────────────────────────────────────────


class Status:
    SUCCESS = "success"
    FAILURE = "failure"
    RUNNING = "running"


class BehaviorNode(ABC):
    @abstractmethod
    def tick(self, v: "Villager", w: "WorldState") -> str:
        ...


class Selector(BehaviorNode):
    """Return SUCCESS on first child success; FAILURE if all children fail."""

    def __init__(self, *children: BehaviorNode) -> None:
        self.children = children

    def tick(self, v: "Villager", w: "WorldState") -> str:
        for child in self.children:
            s = child.tick(v, w)
            if s != Status.FAILURE:
                return s
        return Status.FAILURE


class Sequence(BehaviorNode):
    """Return SUCCESS only when every child succeeds; stop on first failure."""

    def __init__(self, *children: BehaviorNode) -> None:
        self.children = children

    def tick(self, v: "Villager", w: "WorldState") -> str:
        for child in self.children:
            s = child.tick(v, w)
            if s != Status.SUCCESS:
                return s
        return Status.SUCCESS


class Condition(BehaviorNode):
    def __init__(
        self,
        fn: Callable[["Villager", "WorldState"], bool],
        label: str = "",
    ) -> None:
        self._fn = fn
        self.label = label

    def tick(self, v: "Villager", w: "WorldState") -> str:
        return Status.SUCCESS if self._fn(v, w) else Status.FAILURE


class Action(BehaviorNode):
    def __init__(
        self,
        fn: Callable[["Villager", "WorldState"], str],
        label: str = "",
    ) -> None:
        self._fn = fn
        self.label = label

    def tick(self, v: "Villager", w: "WorldState") -> str:
        return self._fn(v, w)


# ─────────────────────────────────────────────────────────────────────────────
# A* Pathfinding
# ─────────────────────────────────────────────────────────────────────────────

_seq: itertools.count[int] = itertools.count()


def find_path(
    start: tuple[int, int],
    end: tuple[int, int],
    world: "WorldState",
) -> list[tuple[int, int]]:
    """Return list of steps from start (exclusive) to end (inclusive).

    Uses A* with Manhattan-distance heuristic.  Water tiles are impassable.
    Returns an empty list when no path exists.
    """
    if start == end:
        return []

    open_heap: list[tuple[int, int, tuple[int, int]]] = []
    heapq.heappush(open_heap, (0, next(_seq), start))
    came_from: dict[tuple[int, int], tuple[int, int]] = {}
    g_score: dict[tuple[int, int], int] = {start: 0}

    while open_heap:
        _, _, current = heapq.heappop(open_heap)
        cx, cy = current

        if current == end:
            path: list[tuple[int, int]] = []
            while current != start:
                path.append(current)
                current = came_from[current]
            path.reverse()
            return path

        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nx, ny = cx + dx, cy + dy
            if not world.in_bounds(nx, ny):
                continue
            if world.grid[ny][nx].type == TileType.WATER:
                continue
            neighbor = (nx, ny)
            new_g = g_score[current] + 1
            if new_g < g_score.get(neighbor, 1_000_000):
                came_from[neighbor] = current
                g_score[neighbor] = new_g
                f = new_g + abs(nx - end[0]) + abs(ny - end[1])
                heapq.heappush(open_heap, (f, next(_seq), neighbor))

    return []  # No path exists


def move_toward(
    v: "Villager",
    tx: int,
    ty: int,
    world: "WorldState",
) -> bool:
    """Advance the villager one step along the A* path toward (tx, ty).

    The path is (re-)computed whenever the target changes or the path runs
    out without reaching the destination.  Returns True if the villager
    is now standing on (tx, ty).
    """
    if v.x == tx and v.y == ty:
        v.path = []
        v.path_target = None
        return True

    if v.path_target != (tx, ty) or not v.path:
        v.path = find_path((v.x, v.y), (tx, ty), world)
        v.path_target = (tx, ty)

    if v.path:
        nx, ny = v.path[0]
        if world.in_bounds(nx, ny) and world.grid[ny][nx].type != TileType.WATER:
            v.x, v.y = nx, ny
            v.path.pop(0)
        else:
            # Obstacle appeared mid-path — force recompute next tick
            v.path = []
            v.path_target = None

    return v.x == tx and v.y == ty


# ─────────────────────────────────────────────────────────────────────────────
# Spatial Helper Queries
# ─────────────────────────────────────────────────────────────────────────────

_REPAIRABLE = frozenset({TileType.HOUSE, TileType.FARM, TileType.WELL})


def _find_nearest(
    x: int,
    y: int,
    w: "WorldState",
    tile_type: TileType,
    *,
    skip_fire: bool = True,
) -> tuple[int, int] | None:
    best: tuple[int, int] | None = None
    best_d = 1_000_000
    for ry in range(w.height):
        for rx in range(w.width):
            t = w.grid[ry][rx]
            if t.type == tile_type and (not skip_fire or not t.on_fire):
                d = abs(rx - x) + abs(ry - y)
                if d < best_d:
                    best_d = d
                    best = (rx, ry)
    return best


def _find_nearest_damaged(
    x: int,
    y: int,
    w: "WorldState",
    threshold: float = 85.0,
) -> tuple[int, int] | None:
    """Return the nearest building with durability below *threshold*."""
    best: tuple[int, int] | None = None
    best_d = 1_000_000
    for ry in range(w.height):
        for rx in range(w.width):
            t = w.grid[ry][rx]
            if t.type in _REPAIRABLE and t.durability < threshold:
                d = abs(rx - x) + abs(ry - y)
                if d < best_d:
                    best_d = d
                    best = (rx, ry)
    return best


# ─────────────────────────────────────────────────────────────────────────────
# Leaf Action Implementations
# ─────────────────────────────────────────────────────────────────────────────


def _flee_fire(v: "Villager", w: "WorldState") -> str:
    """Move to the farthest reachable non-fire tile within radius 5."""
    best: tuple[int, int] | None = None
    best_d = -1
    for dy in range(-5, 6):
        for dx in range(-5, 6):
            nx, ny = v.x + dx, v.y + dy
            if (
                w.in_bounds(nx, ny)
                and not w.grid[ny][nx].on_fire
                and w.grid[ny][nx].type != TileType.WATER
            ):
                d = abs(dx) + abs(dy)
                if d > best_d:
                    best_d = d
                    best = (nx, ny)
    if best is None:
        return Status.FAILURE
    v.state = VillagerState.MOVING
    reached = move_toward(v, best[0], best[1], w)
    return Status.SUCCESS if reached else Status.RUNNING


def _eat_or_seek_food(v: "Villager", w: "WorldState") -> str:
    """Navigate to the nearest farm and eat; fall back to pantry if no farm."""
    farm = _find_nearest(v.x, v.y, w, TileType.FARM)

    if farm is None:
        if w.resources.food > 0:
            w.resources.food -= 1
            v.hunger = max(0.0, v.hunger - 30.0)
            v.state = VillagerState.EATING
            return Status.SUCCESS
        return Status.FAILURE

    fx, fy = farm
    if abs(v.x - fx) + abs(v.y - fy) <= 1:
        if w.resources.food > 0:
            w.resources.food -= 1
            v.hunger = max(0.0, v.hunger - 35.0)
            v.state = VillagerState.EATING
            v.path = []
            v.path_target = None
            return Status.SUCCESS
        return Status.FAILURE  # Farm is empty

    v.state = VillagerState.MOVING
    move_toward(v, fx, fy, w)
    return Status.RUNNING


def _seek_shelter(v: "Villager", w: "WorldState") -> str:
    """Go to the nearest house for night rest and health regen."""
    house = _find_nearest(v.x, v.y, w, TileType.HOUSE)
    if house is None:
        return Status.FAILURE
    hx, hy = house
    if v.x == hx and v.y == hy:
        v.state = VillagerState.IDLE
        v.health = min(100.0, v.health + 0.25)  # Regen while sheltered
        return Status.SUCCESS
    v.state = VillagerState.MOVING
    move_toward(v, hx, hy, w)
    return Status.RUNNING


def _farmer_work(v: "Villager", w: "WorldState") -> str:
    """Go to a farm and tend it, producing bonus food over time."""
    farm = _find_nearest(v.x, v.y, w, TileType.FARM)
    if farm is None:
        return Status.FAILURE
    fx, fy = farm
    if abs(v.x - fx) + abs(v.y - fy) <= 1:
        v.state = VillagerState.WORKING
        if w.tick % 8 == 0:
            w.resources.food += 2  # Bonus harvest beyond passive production
        return Status.SUCCESS
    v.state = VillagerState.MOVING
    move_toward(v, fx, fy, w)
    return Status.RUNNING


def _builder_work(v: "Villager", w: "WorldState") -> str:
    """Locate a damaged structure and repair it using wood from the stockpile."""
    if w.resources.wood < 2:
        return Status.FAILURE  # No materials
    target = _find_nearest_damaged(v.x, v.y, w)
    if target is None:
        return Status.FAILURE  # Nothing to repair
    bx, by = target
    if abs(v.x - bx) + abs(v.y - by) <= 1:
        tile = w.grid[by][bx]
        if w.resources.wood >= 1:
            tile.durability = min(100.0, tile.durability + 8.0)
            w.resources.wood -= 1
        v.state = VillagerState.WORKING
        return Status.SUCCESS
    v.state = VillagerState.MOVING
    move_toward(v, bx, by, w)
    return Status.RUNNING


def _wander(v: "Villager", w: "WorldState") -> str:
    """Idle exploration: pick a random nearby tile and stroll toward it."""
    # Pick a new destination when current one is reached or with low probability
    needs_new = v.path_target is None or random.random() < 0.04

    if needs_new:
        for _ in range(12):
            tx = v.x + random.randint(-7, 7)
            ty = v.y + random.randint(-7, 7)
            tx = max(0, min(w.width - 1, tx))
            ty = max(0, min(w.height - 1, ty))
            if w.grid[ty][tx].type != TileType.WATER:
                v.path = []
                v.path_target = (tx, ty)
                break

    if v.path_target:
        reached = move_toward(v, v.path_target[0], v.path_target[1], w)
        if reached:
            v.path_target = None
            v.state = VillagerState.IDLE
        else:
            v.state = VillagerState.MOVING
    else:
        v.state = VillagerState.IDLE

    return Status.RUNNING


# ─────────────────────────────────────────────────────────────────────────────
# Condition Predicates
# ─────────────────────────────────────────────────────────────────────────────


def _on_fire(v: "Villager", w: "WorldState") -> bool:
    return w.in_bounds(v.x, v.y) and w.grid[v.y][v.x].on_fire


def _critical_hunger(v: "Villager", _w: "WorldState") -> bool:
    return v.hunger >= 70.0


def _hungry_and_food_exists(v: "Villager", w: "WorldState") -> bool:
    return v.hunger >= 50.0 and w.resources.food > 0


def _is_night(v: "Villager", w: "WorldState") -> bool:  # noqa: ARG001
    return w.time_of_day > 0.78 or w.time_of_day < 0.18


def _is_farmer(v: "Villager", _w: "WorldState") -> bool:
    return v.role == JobRole.FARMER


def _is_builder(v: "Villager", _w: "WorldState") -> bool:
    return v.role == JobRole.BUILDER


# ─────────────────────────────────────────────────────────────────────────────
# Behavior Tree Definition
# Priorities (high → low):
#   1. Flee fire          — immediate safety
#   2. Critical hunger    — starvation prevention
#   3. Hungry + food      — proactive food seeking
#   4. Night / shelter    — rest and health regen
#   5. Job role           — farmer or builder duties
#   6. Wander             — idle exploration fallback
# ─────────────────────────────────────────────────────────────────────────────

VILLAGER_BT: BehaviorNode = Selector(
    # 1 ── Safety: flee from fire
    Sequence(
        Condition(_on_fire, "OnFire?"),
        Action(_flee_fire, "FleeFire"),
    ),
    # 2 ── Survival: critical starvation
    Sequence(
        Condition(_critical_hunger, "CriticalHunger?"),
        Action(_eat_or_seek_food, "EatCritical"),
    ),
    # 3 ── Survival: proactive hunger management
    Sequence(
        Condition(_hungry_and_food_exists, "Hungry?"),
        Action(_eat_or_seek_food, "Eat"),
    ),
    # 4 ── Comfort: seek shelter at night
    Sequence(
        Condition(_is_night, "IsNight?"),
        Action(_seek_shelter, "Shelter"),
    ),
    # 5 ── Identity: job role behaviour
    Selector(
        Sequence(Condition(_is_farmer, "IsFarmer?"), Action(_farmer_work, "FarmWork")),
        Sequence(Condition(_is_builder, "IsBuilder?"), Action(_builder_work, "BuildWork")),
    ),
    # 6 ── Default: idle wandering
    Action(_wander, "Wander"),
)
