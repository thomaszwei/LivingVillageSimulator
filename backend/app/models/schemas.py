from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, Text
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class WorldSnapshot(Base):
    __tablename__ = "world_state"

    id = Column(Integer, primary_key=True, autoincrement=True)
    state_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class EventLog(Base):
    __tablename__ = "events_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_type = Column(Text, nullable=False)
    data = Column(Text, nullable=False)
    tick = Column(Integer, nullable=False)
    triggered_by = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(Text, nullable=False, unique=True)
    credits = Column(Integer, nullable=False, default=100)
    actions_taken = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class VoteLog(Base):
    __tablename__ = "vote_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    round_id = Column(Integer, nullable=False)
    username = Column(Text, nullable=True)       # null = anonymous vote
    disaster_type = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
