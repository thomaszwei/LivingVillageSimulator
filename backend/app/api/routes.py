"""REST API routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

# The engine reference is set by main.py at startup.
_engine: Any = None


def set_engine(engine: Any) -> None:
    global _engine
    _engine = engine


class ActionRequest(BaseModel):
    type: str
    x: int = 25
    y: int = 25


@router.get("/state")
async def get_state() -> dict[str, Any]:
    if _engine is None:
        raise HTTPException(status_code=503, detail="Simulation not running")
    return _engine.world.to_dict()


@router.post("/action")
async def post_action(req: ActionRequest) -> dict[str, Any]:
    if _engine is None:
        raise HTTPException(status_code=503, detail="Simulation not running")
    result = _engine.handle_action(req.type, req.x, req.y)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "Action failed"))
    return result
