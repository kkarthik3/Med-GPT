"""NVIDIA reranker integration using the llama-nemotron-rerank API."""

import logging

import requests

from app.config import NVIDIA_API_KEY, NVIDIA_RERANK_MODEL, NVIDIA_RERANK_URL, TOP_K_RERANK

logger = logging.getLogger(__name__)


def rerank(
    query: str,
    passages: list[dict],
    top_k: int = TOP_K_RERANK,
) -> list[dict]:
    """
    Rerank passages using NVIDIA's llama-nemotron-rerank-vl-1b-v2 model.

    Args:
        query: The user's search query.
        passages: List of dicts with at least a 'text' key.
        top_k: Number of top results to return after reranking.

    Returns:
        The top_k passages sorted by reranker score (descending).
        Each passage dict is augmented with a 'rerank_score' key.
    """
    if not passages:
        return []

    # If fewer passages than top_k, just return them all
    if len(passages) <= top_k:
        for p in passages:
            p["rerank_score"] = 1.0
        return passages

    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Accept": "application/json",
    }

    # Build passages payload (text-only, no images for medical text)
    api_passages = [{"text": p["text"]} for p in passages]

    payload = {
        "model": NVIDIA_RERANK_MODEL,
        "query": {"text": query},
        "passages": api_passages,
    }

    try:
        response = requests.post(
            NVIDIA_RERANK_URL,
            headers=headers,
            json=payload,
            timeout=30,
        )
        response.raise_for_status()
        result = response.json()

        # The API returns rankings with index and logit scores
        rankings = result.get("rankings", [])

        # Sort by logit (descending)
        rankings.sort(key=lambda r: r.get("logit", 0), reverse=True)

        reranked: list[dict] = []
        for rank_info in rankings[:top_k]:
            idx = rank_info["index"]
            passage = passages[idx].copy()
            passage["rerank_score"] = rank_info.get("logit", 0.0)
            reranked.append(passage)

        return reranked

    except requests.exceptions.RequestException as e:
        logger.warning(f"Reranker API call failed: {e}. Returning top-k without reranking.")
        # Fallback: return top_k passages by original score
        return passages[:top_k]
