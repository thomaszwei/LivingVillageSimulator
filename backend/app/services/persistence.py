"""Persistence service — save/load world state to PostgreSQL."""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING

from app.database import async_session_factory
from app.models.schemas import EventLog, WorldSnapshot

if TYPE_CHECKING:
    from app.simulation.world import WorldState

logger = logging.getLogger("persistence")


async def persist_world(world: WorldState) -> None:
    """Save a JSON snapshot of the current world state."""
    try:
        async with async_session_factory() as session:
            snapshot = WorldSnapshot(state_json=json.dumps(world.to_dict()))
            session.add(snapshot)
            await session.commit()
            logger.debug("World state persisted at tick %d", world.tick)
    except Exception:
        logger.exception("Failed to persist world state")


async def log_events(world: WorldState) -> None:
    """Flush recent events to the events_log table."""
    if not world.events:
        return
    try:
        async with async_session_factory() as session:
            for e in world.events[-10:]:
                entry = EventLog(
                    event_type=e.type,
                    data=e.message,
                    tick=e.tick,
                )
                session.add(entry)
            await session.commit()
    except Exception:
        logger.exception("Failed to log events")


async def persist_callback(world: WorldState) -> None:
    """Combined callback used by the engine."""
    await persist_world(world)
    await log_events(world)
