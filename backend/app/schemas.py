"""Pydantic schemas for API request / response validation."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ─── File / Upload ────────────────────────────────────────────────────────────

class FileOut(BaseModel):
    """Response schema for a single uploaded file."""
    id: int
    filename: str
    file_type: str
    is_parsed: bool

    class Config:
        from_attributes = True


class UploadResponse(BaseModel):
    """Response after uploading files to a segment."""
    segment_id: str
    files: list[FileOut]


# ─── Summarization ────────────────────────────────────────────────────────────

class SummarizeRequest(BaseModel):
    """Request to summarize all documents in a segment."""
    segment_id: str = Field(..., description="Segment ID to summarize")


class SummarizeResponse(BaseModel):
    """Structured medical summary response."""
    segment_id: str
    summary: str
    files_processed: list[str]
    model_used: str


# ─── Chat / RAG ───────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    """Request to chat with the RAG system for a segment."""
    segment_id: str = Field(..., description="Segment ID for context")
    query: str = Field(..., description="User question")


class SourceInfo(BaseModel):
    """Source document reference in a chat response."""
    filename: str
    chunk_preview: str = Field(default="", description="Short preview of the matched chunk")


class ChatResponse(BaseModel):
    """Chat response with answer and source documents."""
    segment_id: str
    answer: str
    sources: list[SourceInfo]
    model_used: str


# ─── Chat History ─────────────────────────────────────────────────────────────

class ChatHistoryItem(BaseModel):
    """A single chat history entry."""
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatHistoryResponse(BaseModel):
    """Full chat history for a segment."""
    segment_id: str
    messages: list[ChatHistoryItem]


# ─── Segment Info ─────────────────────────────────────────────────────────────

class SegmentInfo(BaseModel):
    """Summary information about a segment."""
    segment_id: str
    file_count: int
    parsed_count: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
