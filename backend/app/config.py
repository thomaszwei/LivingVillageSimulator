import os

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@db:5432/village",
)
SYNC_DATABASE_URL: str = os.getenv(
    "SYNC_DATABASE_URL",
    "postgresql://postgres:postgres@db:5432/village",
)

GRID_WIDTH: int = int(os.getenv("GRID_WIDTH", "50"))
GRID_HEIGHT: int = int(os.getenv("GRID_HEIGHT", "50"))
TICK_INTERVAL: float = float(os.getenv("TICK_INTERVAL", "0.3"))
WS_BROADCAST_EVERY: int = int(os.getenv("WS_BROADCAST_EVERY", "3"))
DAY_LENGTH_TICKS: int = int(os.getenv("DAY_LENGTH_TICKS", "200"))
PERSIST_EVERY: int = int(os.getenv("PERSIST_EVERY", "50"))
VOTE_CYCLE_TICKS: int = int(os.getenv("VOTE_CYCLE_TICKS", "200"))  # ~60 s at default tick rate

INITIAL_VILLAGERS: int = 5
INITIAL_TREES: int = 18
INITIAL_WOOD: int = 50
INITIAL_FOOD: int = 60
INITIAL_WATER: int = 50
