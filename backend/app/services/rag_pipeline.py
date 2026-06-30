"""Full RAG pipeline — orchestrates parsing, chunking, embedding, retrieval, reranking, and generation."""

import logging

from sqlalchemy.orm import Session

from app import models
from app.services.parser import parse_file
from app.services.chunker import chunk_text
from app.services.vectorstore import HybridRetriever
from app.services.reranker import rerank
from app.services.summarizer import generate_chat_response

logger = logging.getLogger(__name__)


def _get_unparsed_files(db: Session, segment_id: str) -> list[models.File]:
    """Fetch all files that haven't been parsed yet for a segment."""
    return (
        db.query(models.File)
        .filter(
            models.File.segment_id == segment_id,
            models.File.is_parsed == False,  # noqa: E712
        )
        .all()
    )


def _get_chat_history(db: Session, segment_id: str, limit: int = 10) -> list[dict]:
    """Fetch recent chat history for a segment."""
    history = (
        db.query(models.ChatHistory)
        .filter(models.ChatHistory.segment_id == segment_id)
        .order_by(models.ChatHistory.created_at.asc())
        .limit(limit)
        .all()
    )
    return [{"role": h.role, "content": h.content} for h in history]


def _save_chat_message(db: Session, segment_id: str, role: str, content: str):
    """Save a chat message to history."""
    msg = models.ChatHistory(
        segment_id=segment_id,
        role=role,
        content=content,
    )
    db.add(msg)
    db.commit()


def process_unparsed_files(db: Session, segment_id: str, retriever: HybridRetriever) -> list[str]:
    """
    Parse and index any unparsed files for a segment.

    Returns list of filenames that were processed.
    """
    unparsed = _get_unparsed_files(db, segment_id)
    if not unparsed:
        return []

    all_chunks: list[dict] = []
    processed_filenames: list[str] = []

    for file_record in unparsed:
        try:
            text = parse_file(file_record.filepath)
            if not text.strip():
                logger.warning(f"Empty content from file: {file_record.filename}")
                continue

            chunks = chunk_text(
                text=text,
                metadata={
                    "filename": file_record.filename,
                    "file_type": file_record.file_type,
                    "segment_id": segment_id,
                },
            )
            all_chunks.extend(chunks)
            processed_filenames.append(file_record.filename)

            # Mark as parsed
            file_record.is_parsed = True

        except Exception as e:
            logger.error(f"Failed to parse {file_record.filename}: {e}")
            continue

    # Embed and index all new chunks at once
    if all_chunks:
        logger.info(f"Indexing {len(all_chunks)} chunks for segment '{segment_id}'")
        retriever.add_chunks(all_chunks)

    db.commit()
    return processed_filenames


async def rag_query(
    db: Session,
    segment_id: str,
    query: str,
) -> dict:
    """
    Execute the full RAG pipeline:
    1. Parse any new (unparsed) files
    2. Hybrid retrieve (FAISS + BM25)
    3. Rerank with NVIDIA
    4. Generate response with Ollama
    5. Save to chat history

    Returns dict with 'answer', 'sources', 'files_processed'.
    """
    # Initialize retriever for this segment
    retriever = HybridRetriever(segment_id)

    # Step 1: Process any new files
    newly_processed = process_unparsed_files(db, segment_id, retriever)

    if not retriever.has_index:
        return {
            "answer": "No documents have been uploaded for this segment yet. Please upload files first.",
            "sources": [],
            "files_processed": [],
        }

    # Step 2: Hybrid retrieval
    candidates = retriever.search(query)

    if not candidates:
        return {
            "answer": "I couldn't find relevant information in the uploaded documents for your query.",
            "sources": [],
            "files_processed": newly_processed,
        }

    # Step 3: Rerank
    reranked = rerank(query, candidates)

    # Step 4: Build context from reranked results
    context_parts: list[str] = []
    sources: list[dict] = []
    for item in reranked:
        filename = item["metadata"].get("filename", "unknown")
        context_parts.append(f"[Source: {filename}]\n{item['text']}")
        sources.append({
            "filename": filename,
            "chunk_preview": item["text"][:150] + "..." if len(item["text"]) > 150 else item["text"],
        })

    context = "\n\n---\n\n".join(context_parts)

    # Step 5: Get chat history
    chat_history = _get_chat_history(db, segment_id)

    # Step 6: Generate response
    answer = await generate_chat_response(query, context, chat_history)

    # Step 7: Save to chat history
    _save_chat_message(db, segment_id, "user", query)
    _save_chat_message(db, segment_id, "assistant", answer)

    return {
        "answer": answer,
        "sources": sources,
        "files_processed": newly_processed,
    }
