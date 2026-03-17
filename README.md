# Living Village Simulator

A real-time, browser-based simulation of a small village where villagers live, work, eat, and die. Resources are produced and consumed, random events occur, and users can interact with the world in real time.

## Quick Start

```bash
docker compose up --build
```

Then open **http://localhost:3000** in your browser.

## Architecture

| Service   | Port | Description                            |
|-----------|------|----------------------------------------|
| frontend  | 3000 | Next.js web UI with canvas rendering   |
| backend   | 8000 | FastAPI simulation engine + WebSocket  |
| db        | 5432 | PostgreSQL for state persistence       |

## Simulation

- **Tick-based engine** running every 300ms
- **50x50 grid** with grass, water, trees, farms, houses, and wells
- **Villager AI**: wander, seek food when hungry, flee from fire, age, and die
- **Resource production**: farms produce food, trees produce wood, wells provide water
- **Day/night cycle** with visual overlay

### Events

- **Fire** — spreads to adjacent tiles, destroys buildings and trees
- **Rain** — extinguishes fires in a 5-tile radius
- **Disease** — randomly reduces villager health

## Interactions

Click on the map after selecting an action:

| Action      | Cost    | Effect                              |
|-------------|---------|-------------------------------------|
| Plant Tree  | 5 wood  | Places a tree on a grass tile       |
| Build House | 15 wood | Places a house on a grass tile      |
| Start Fire  | Free    | Ignites the target tile             |
| Trigger Rain| Free    | Extinguishes fires in the area      |

## API

- `GET /state` — current world state as JSON
- `POST /action` — `{ "type": "spawn_tree", "x": 10, "y": 20 }`
- `WS /ws` — real-time state updates

## Tech Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy, asyncpg
- **Frontend**: Next.js 15, TypeScript, TailwindCSS, HTML5 Canvas
- **Database**: PostgreSQL 16
- **Infrastructure**: Docker Compose
