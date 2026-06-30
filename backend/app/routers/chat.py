"""Chat router — RAG-based chatbot for medical document Q&A."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.config import OLLAMA_MODEL
from app.schemas import ChatRequest, ChatResponse, SourceInfo, ChatHistoryResponse, ChatHistoryItem

from app.services.rag_pipeline import rag_query

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Chat / RAG"])


@router.post("/", response_model=ChatResponse)
async def chat_with_documents(
    request: ChatRequest,
    db: Session = Depends(get_db),
):
    """
    Chat with medical documents using RAG.

    Pipeline:
    1. Parse any unparsed files for the segment
    2. Chunk & embed new documents (NVIDIA embeddings)
    3. Hybrid retrieval (FAISS + BM25)
    4. Rerank candidates (NVIDIA reranker)
    5. Generate answer (Ollama via LiteLLM)
    6. Persist chat history
    """
    segment_id = request.segment_id
    query = request.query

    # Validate segment exists
    segment = (
        db.query(models.Segment)
        .filter(models.Segment.segment_id == segment_id)
        .first()
    )
    if segment is None:
        raise HTTPException(
            status_code=404,
            detail=f"Segment '{segment_id}' not found. Upload files first.",
        )

    try:
        result = await rag_query(db, segment_id, query)
    except Exception as e:
        logger.error(f"RAG pipeline error for segment '{segment_id}': {e}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while processing your query: {str(e)}",
        )

    sources = [
        SourceInfo(
            filename=s["filename"],
            chunk_preview=s.get("chunk_preview", ""),
        )
        for s in result.get("sources", [])
    ]

    return ChatResponse(
        segment_id=segment_id,
        answer=result["answer"],
        sources=sources,
        model_used=OLLAMA_MODEL,
    )


@router.get("/history/{segment_id}", response_model=ChatHistoryResponse)
def get_chat_history(
    segment_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve the full chat history for a segment."""
    segment = (
        db.query(models.Segment)
        .filter(models.Segment.segment_id == segment_id)
        .first()
    )
    if segment is None:
        raise HTTPException(
            status_code=404,
            detail=f"Segment '{segment_id}' not found.",
        )

    history = (
        db.query(models.ChatHistory)
        .filter(models.ChatHistory.segment_id == segment_id)
        .order_by(models.ChatHistory.created_at.asc())
        .all()
    )

    messages = [
        ChatHistoryItem(
            role=h.role,
            content=h.content,
            created_at=h.created_at,
        )
        for h in history
    ]

    return ChatHistoryResponse(segment_id=segment_id, messages=messages)


@router.delete("/history/{segment_id}")
def clear_chat_history(
    segment_id: str,
    db: Session = Depends(get_db),
):
    """Clear all chat history for a segment."""
    deleted = (
        db.query(models.ChatHistory)
        .filter(models.ChatHistory.segment_id == segment_id)
        .delete()
    )
    db.commit()
    return {"segment_id": segment_id, "messages_deleted": deleted}
