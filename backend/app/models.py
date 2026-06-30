"""SQLAlchemy ORM models for segments, files, and chat history."""

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Segment(Base):
    """Groups uploaded files under a logical segment (e.g. a patient case)."""

    __tablename__ = "segments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    segment_id = Column(String(255), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    files = relationship("File", back_populates="segment", cascade="all, delete-orphan")
    chat_history = relationship(
        "ChatHistory", back_populates="segment", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Segment(segment_id='{self.segment_id}')>"


class File(Base):
    """Tracks an uploaded file and its parsing status."""

    __tablename__ = "files"

    id = Column(Integer, primary_key=True, autoincrement=True)
    segment_id = Column(
        String(255),
        ForeignKey("segments.segment_id"),
        nullable=False,
        index=True,
    )
    filename = Column(String(512), nullable=False)
    filepath = Column(String(1024), nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, docx, csv, xlsx
    is_parsed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    segment = relationship("Segment", back_populates="files")

    def __repr__(self) -> str:
        return f"<File(filename='{self.filename}', parsed={self.is_parsed})>"


class ChatHistory(Base):
    """Stores chat messages per segment for conversation continuity."""

    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    segment_id = Column(
        String(255),
        ForeignKey("segments.segment_id"),
        nullable=False,
        index=True,
    )
    role = Column(String(50), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    segment = relationship("Segment", back_populates="chat_history")

    def __repr__(self) -> str:
        return f"<ChatHistory(role='{self.role}', segment='{self.segment_id}')>"
