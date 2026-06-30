"""Text chunking using LangChain's RecursiveCharacterTextSplitter."""

from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.config import CHUNK_SIZE, CHUNK_OVERLAP


def chunk_text(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP,
    metadata: dict | None = None,
) -> list[dict]:
    """
    Split text into chunks with metadata.

    Returns a list of dicts with keys: 'text', 'metadata'.
    Metadata always includes 'chunk_index'.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    chunks = splitter.split_text(text)
    base_metadata = metadata or {}

    return [
        {
            "text": chunk,
            "metadata": {**base_metadata, "chunk_index": i},
        }
        for i, chunk in enumerate(chunks)
    ]


def chunk_documents(
    documents: list[dict],
) -> list[dict]:
    """
    Chunk multiple documents. Each document is a dict with 'text' and 'metadata' keys.

    The metadata from each document is preserved and augmented with chunk_index.
    """
    all_chunks: list[dict] = []
    for doc in documents:
        doc_chunks = chunk_text(
            text=doc["text"],
            metadata=doc.get("metadata", {}),
        )
        all_chunks.extend(doc_chunks)
    return all_chunks
