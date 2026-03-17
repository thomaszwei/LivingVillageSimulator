"""World state data structures and initialization."""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from app.config import (
    GRID_HEIGHT,
    GRID_WIDTH,
    INITIAL_FOOD,
    INITIAL_TREES,
    INITIAL_VILLAGERS,
    INITIAL_WATER,
    INITIAL_WOOD,
)

VILLAGER_NAMES: list[str] = [
    "Ada", "Bjorn", "Celia", "Doran", "Elara", "Finn", "Greta", "Hector",
    "Ingrid", "Jasper", "Kira", "Leif", "Mira", "Nico", "Olga", "Per",
    "Quinn", "Rowan", "Signe", "Tove", "Ulf", "Vera", "Wren", "Xander",
    "Yara", "Zeke",
]


class TileType(str, Enum):
    GRASS = "grass"
    WATER = "water"
    TREE = "tree"
    FARM = "farm"
    HOUSE = "house"
    WELL = "well"


class VillagerState(str, Enum):
    IDLE = "idle"
    MOVING = "moving"
    EATING = "eating"
    WORKING = "working"
    DEAD = "dead"


class JobRole(str, Enum):
    FARMER = "farmer"
    BUILDER = "builder"


@dataclass
class Tile:
    type: TileType = TileType.GRASS
    on_fire: bool = False
    durability: float = 100.0


@dataclass
class Villager:
    id: int
    name: str
    role: JobRole = JobRole.FARMER
    age: float = 20.0
    hunger: float = 0.0
    health: float = 100.0
    x: int = 0
    y: int = 0
    state: VillagerState = VillagerState.IDLE
    # Pathfinding state — managed by ai.move_toward
    path: list[tuple[int, int]] = field(default_factory=list)
    path_target: tuple[int, int] | None = None

    def is_alive(self) -> bool:
        return self.state != VillagerState.DEAD


@dataclass
class Resources:
    wood: int = 0
    food: int = 0
    water: int = 0


@dataclass
class GameEvent:
    type: str
    message: str
    tick: int


@dataclass
class WorldState:
    width: int = GRID_WIDTH
    height: int = GRID_HEIGHT
    tick: int = 0
    time_of_day: float = 0.25
    day_count: int = 1
    grid: list[list[Tile]] = field(default_factory=list)
    villagers: list[Villager] = field(default_factory=list)
    resources: Resources = field(default_factory=Resources)
    events: list[GameEvent] = field(default_factory=list)
    rain_level: float = 0.0   # 0.0 = dry, 1.0 = heavy rain; decays each tick
    _next_villager_id: int = 1

    # ------------------------------------------------------------------
    # Initialization
    # ------------------------------------------------------------------

    def initialize(self) -> None:
        """Build the starting world."""
        self.grid = [
            [Tile(type=TileType.GRASS) for _ in range(self.width)]
            for _ in range(self.height)
        ]

        # Place a small pond
        pond_cx, pond_cy = self.width // 4, self.height // 4
        for dy in range(-1, 2):
            for dx in range(-1, 2):
                px, py = pond_cx + dx, pond_cy + dy
                if 0 <= px < self.width and 0 <= py < self.height:
                    self.grid[py][px] = Tile(type=TileType.WATER)

        # Place trees
        placed = 0
        while placed < INITIAL_TREES:
            x = random.randint(0, self.width - 1)
            y = random.randint(0, self.height - 1)
            if self.grid[y][x].type == TileType.GRASS:
                self.grid[y][x] = Tile(type=TileType.TREE, durability=100.0)
                placed += 1

        # Place farms near centre
        cx, cy = self.width // 2, self.height // 2
        self.grid[cy][cx] = Tile(type=TileType.FARM, durability=100.0)
        self.grid[cy][cx + 1] = Tile(type=TileType.FARM, durability=100.0)

        # Place a well near the pond
        self.grid[pond_cy + 2][pond_cx] = Tile(type=TileType.WELL, durability=100.0)

        # Place two houses so builders have targets and villagers can shelter
        self.grid[cy - 2][cx] = Tile(type=TileType.HOUSE, durability=100.0)
        self.grid[cy - 2][cx + 3] = Tile(type=TileType.HOUSE, durability=80.0)

        # Resources
        self.resources = Resources(
            wood=INITIAL_WOOD,
            food=INITIAL_FOOD,
            water=INITIAL_WATER,
        )

        # Villagers — alternate roles: farmer, builder, farmer, …
        for _ in range(INITIAL_VILLAGERS):
            self._spawn_villager_near(cx, cy)

    def _spawn_villager_near(self, cx: int, cy: int) -> Villager:
        vid = self._next_villager_id
        self._next_villager_id += 1
        name = random.choice(VILLAGER_NAMES)
        vx = max(0, min(self.width - 1, cx + random.randint(-5, 5)))
        vy = max(0, min(self.height - 1, cy + random.randint(-5, 5)))
        # Odd IDs → FARMER, even IDs → BUILDER
        role = JobRole.FARMER if vid % 2 == 1 else JobRole.BUILDER
        v = Villager(
            id=vid,
            name=name,
            role=role,
            age=round(random.uniform(18.0, 40.0), 1),
            hunger=round(random.uniform(0.0, 20.0), 1),
            health=100.0,
            x=vx,
            y=vy,
        )
        self.villagers.append(v)
        return v

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def in_bounds(self, x: int, y: int) -> bool:
        return 0 <= x < self.width and 0 <= y < self.height

    def living_villagers(self) -> list[Villager]:
        return [v for v in self.villagers if v.is_alive()]

    def add_event(self, etype: str, message: str) -> None:
        self.events.append(GameEvent(type=etype, message=message, tick=self.tick))
        if len(self.events) > 200:
            self.events = self.events[-100:]

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------

    def to_dict(self) -> dict[str, Any]:
        return {
            "tick": self.tick,
            "timeOfDay": round(self.time_of_day, 3),
            "dayCount": self.day_count,
            "rainLevel": round(self.rain_level, 3),
            "grid": [[tile.type.value for tile in row] for row in self.grid],
            "fires": [[tile.on_fire for tile in row] for row in self.grid],
            "villagers": [
                {
                    "id": v.id,
                    "name": v.name,
                    "role": v.role.value,
                    "age": round(v.age, 1),
                    "hunger": round(v.hunger, 1),
                    "health": round(v.health, 1),
                    "x": v.x,
                    "y": v.y,
                    "state": v.state.value,
                }
                for v in self.villagers
                if v.is_alive()
            ],
            "resources": {
                "wood": self.resources.wood,
                "food": self.resources.food,
                "water": self.resources.water,
            },
            "population": len(self.living_villagers()),
            "events": [
                {"type": e.type, "message": e.message, "tick": e.tick}
                for e in self.events[-30:]
            ],
        }
