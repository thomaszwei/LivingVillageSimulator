"""FastAPI application entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router, set_engine
from app.api.websocket import manager
from app.database import engine as db_engine
from app.models.schemas import Base
from app.services.persistence import persist_callback
from app.simulation.engine import SimulationEngine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("main")

sim_engine = SimulationEngine()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Create tables
    async with db_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ready")

    # Wire up the engine callbacks
    set_engine(sim_engine)
    sim_engine.set_broadcast_callback(manager.broadcast)
    sim_engine.set_persist_callback(persist_callback)
    sim_engine.start()
    logger.info("Simulation engine started")

    yield

    await sim_engine.stop()
    await db_engine.dispose()
    logger.info("Shutdown complete")


app = FastAPI(title="Living Village Simulator", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        # Send initial state immediately
        await ws.send_json(sim_engine.world.to_dict())
        # Keep connection alive; listen for pings / close
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)
