"""Summarization router — generates medical summaries for a segment's documents."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.config import OLLAMA_MODEL
from app.schemas import SummarizeRequest, SummarizeResponse
from app.services.parser import parse_file
from app.services.summarizer import summarize_medical_report

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/summarize", tags=["Summarization"])


@router.post("/", response_model=SummarizeResponse)
async def summarize_segment(
    request: SummarizeRequest,
    db: Session = Depends(get_db),
):
    """
    Summarize all medical documents in a segment.

    Parses every file (PDF, DOCX, CSV, Excel) under the given segment_id,
    concatenates the text, and generates a structured medical summary
    using Ollama via LiteLLM.
    """
    segment_id = request.segment_id

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

    # Get all files for this segment
    files = (
        db.query(models.File)
        .filter(models.File.segment_id == segment_id)
        .all()
    )
    if not files:
        raise HTTPException(
            status_code=404,
            detail=f"No files found in segment '{segment_id}'.",
        )

    # Parse all files
    document_texts: list[str] = []
    processed_filenames: list[str] = []

    for file_record in files:
        try:
            text = parse_file(file_record.filepath)
            if text.strip():
                document_texts.append(
                    f"=== File: {file_record.filename} ===\n{text}"
                )
                processed_filenames.append(file_record.filename)
            else:
                logger.warning(f"Empty content: {file_record.filename}")
        except Exception as e:
            logger.error(f"Failed to parse {file_record.filename}: {e}")
            continue

    if not document_texts:
        raise HTTPException(
            status_code=422,
            detail="Could not extract text from any files in this segment.",
        )

    # Concatenate and summarize
    full_text = "\n\n".join(document_texts)

    # Truncate if too long (model context window safety)
    max_chars = 50_000
    if len(full_text) > max_chars:
        logger.warning(
            f"Document text truncated from {len(full_text)} to {max_chars} chars"
        )
        full_text = full_text[:max_chars] + "\n\n[... Document truncated for processing ...]"

    summary = await summarize_medical_report(full_text)

    return SummarizeResponse(
        segment_id=segment_id,
        summary=summary,
        files_processed=processed_filenames,
        model_used=OLLAMA_MODEL,
    )
