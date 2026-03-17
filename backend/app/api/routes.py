"""REST API routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.schemas import User, VoteLog

router = APIRouter()

# The engine reference is set by main.py at startup.
_engine: Any = None


def set_engine(engine: Any) -> None:
    global _engine
    _engine = engine


# Credits deducted per successful action
ACTION_COSTS: dict[str, int] = {
    "spawn_tree":   5,
    "build_house":  15,
    "trigger_fire": 10,
    "trigger_rain": 20,
}


class ActionRequest(BaseModel):
    type: str
    x: int = 25
    y: int = 25
    username: str | None = None


class UserRequest(BaseModel):
    username: str


class VoteRequest(BaseModel):
    disaster: str
    username: str | None = None


# ── World state ───────────────────────────────────────────────────────────────

@router.get("/state")
async def get_state() -> dict[str, Any]:
    if _engine is None:
        raise HTTPException(status_code=503, detail="Simulation not running")
    return _engine.world.to_dict()


# ── User management ───────────────────────────────────────────────────────────

@router.post("/users")
async def create_or_get_user(
    req: UserRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    username = req.username.strip()[:32]
    if not username:
        raise HTTPException(status_code=400, detail="Username cannot be empty")

    rows = await session.execute(select(User).where(User.username == username))
    user = rows.scalar_one_or_none()
    if user is None:
        user = User(username=username)
        session.add(user)
        await session.commit()
        await session.refresh(user)

    return {
        "id": user.id,
        "username": user.username,
        "credits": user.credits,
        "actions_taken": user.actions_taken,
    }


@router.get("/leaderboard")
async def get_leaderboard(
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    rows = await session.execute(
        select(User).order_by(User.actions_taken.desc()).limit(20)
    )
    users = rows.scalars().all()
    return [
        {
            "rank": i + 1,
            "username": u.username,
            "credits": u.credits,
            "actions_taken": u.actions_taken,
        }
        for i, u in enumerate(users)
    ]


# ── Actions ───────────────────────────────────────────────────────────────────

@router.post("/action")
async def post_action(
    req: ActionRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    if _engine is None:
        raise HTTPException(status_code=503, detail="Simulation not running")

    user = None
    if req.username:
        rows = await session.execute(select(User).where(User.username == req.username))
        user = rows.scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        cost = ACTION_COSTS.get(req.type, 0)
        if user.credits < cost:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough credits (need {cost}, have {user.credits})",
            )

    action_result = _engine.handle_action(req.type, req.x, req.y, triggered_by=req.username)
    if not action_result.get("ok"):
        raise HTTPException(status_code=400, detail=action_result.get("error", "Action failed"))

    if user is not None:
        cost = ACTION_COSTS.get(req.type, 0)
        user.credits = max(0, user.credits - cost)
        user.actions_taken += 1
        await session.commit()
        return {**action_result, "credits": user.credits, "actions_taken": user.actions_taken}

    return action_result


# ── Voting ────────────────────────────────────────────────────────────────────

@router.post("/vote")
async def cast_vote(
    req: VoteRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    if _engine is None:
        raise HTTPException(status_code=503, detail="Simulation not running")

    result = _engine.cast_vote(req.username, req.disaster)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "Vote failed"))

    # Persist to vote_log
    session.add(VoteLog(
        round_id=result["round"],
        username=req.username,
        disaster_type=req.disaster,
    ))
    await session.commit()

    return result
