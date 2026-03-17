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
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
