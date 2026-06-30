"""NVIDIA Embeddings wrapper using langchain_nvidia_ai_endpoints."""

from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings

from app.config import NVIDIA_API_KEY, NVIDIA_EMBED_MODEL


def get_embedding_client() -> NVIDIAEmbeddings:
    """Return a configured NVIDIA embeddings client."""
    return NVIDIAEmbeddings(
        model=NVIDIA_EMBED_MODEL,
        api_key=NVIDIA_API_KEY,
        truncate="NONE",
    )


def embed_query(query: str) -> list[float]:
    """Embed a single query string."""
    client = get_embedding_client()
    return client.embed_query(query)


def embed_documents(texts: list[str]) -> list[list[float]]:
    """Embed a list of document texts."""
    client = get_embedding_client()
    return client.embed_documents(texts)
