"""FAISS vector store + BM25 hybrid retrieval per segment."""

import json
import pickle
from pathlib import Path

import faiss
import numpy as np
from rank_bm25 import BM25Okapi

from app.config import FAISS_DIR, TOP_K_RETRIEVAL
from app.services.embeddings import get_embedding_client


class HybridRetriever:
    """
    Hybrid retriever combining FAISS (dense) and BM25 (sparse) search.

    Each segment gets its own persisted index stored under:
        data/faiss/{segment_id}/
    """

    def __init__(self, segment_id: str):
        self.segment_id = segment_id
        self.index_dir = FAISS_DIR / segment_id
        self.index_dir.mkdir(parents=True, exist_ok=True)

        self.faiss_path = self.index_dir / "index.faiss"
        self.metadata_path = self.index_dir / "metadata.json"
        self.bm25_path = self.index_dir / "bm25.pkl"
        self.texts_path = self.index_dir / "texts.json"

        self.embedding_client = get_embedding_client()
        self.faiss_index: faiss.IndexFlatIP | None = None
        self.chunks_metadata: list[dict] = []
        self.chunk_texts: list[str] = []
        self.bm25: BM25Okapi | None = None

        self._load_existing()

    def _load_existing(self):
        """Load previously saved indices from disk."""
        if self.faiss_path.exists():
            self.faiss_index = faiss.read_index(str(self.faiss_path))

        if self.metadata_path.exists():
            with open(self.metadata_path, "r", encoding="utf-8") as f:
                self.chunks_metadata = json.load(f)

        if self.texts_path.exists():
            with open(self.texts_path, "r", encoding="utf-8") as f:
                self.chunk_texts = json.load(f)

        if self.bm25_path.exists():
            with open(self.bm25_path, "rb") as f:
                self.bm25 = pickle.load(f)

    def add_chunks(self, chunks: list[dict]):
        """
        Add new chunks to both FAISS and BM25 indices.

        Each chunk is a dict with 'text' and 'metadata' keys.
        """
        if not chunks:
            return

        new_texts = [c["text"] for c in chunks]
        new_metadata = [c["metadata"] for c in chunks]

        # --- Embed new texts ---
        embeddings = self.embedding_client.embed_documents(new_texts)
        embeddings_np = np.array(embeddings, dtype=np.float32)

        # Normalize for cosine similarity via inner product
        faiss.normalize_L2(embeddings_np)

        # --- Update FAISS ---
        dim = embeddings_np.shape[1]
        if self.faiss_index is None:
            self.faiss_index = faiss.IndexFlatIP(dim)

        self.faiss_index.add(embeddings_np)

        # --- Update metadata & texts ---
        self.chunks_metadata.extend(new_metadata)
        self.chunk_texts.extend(new_texts)

        # --- Rebuild BM25 over all texts ---
        tokenized = [text.lower().split() for text in self.chunk_texts]
        self.bm25 = BM25Okapi(tokenized)

        # --- Persist ---
        self._save()

    def _save(self):
        """Persist all indices to disk."""
        if self.faiss_index is not None:
            faiss.write_index(self.faiss_index, str(self.faiss_path))

        with open(self.metadata_path, "w", encoding="utf-8") as f:
            json.dump(self.chunks_metadata, f, ensure_ascii=False)

        with open(self.texts_path, "w", encoding="utf-8") as f:
            json.dump(self.chunk_texts, f, ensure_ascii=False)

        if self.bm25 is not None:
            with open(self.bm25_path, "wb") as f:
                pickle.dump(self.bm25, f)

    def search(self, query: str, top_k: int = TOP_K_RETRIEVAL) -> list[dict]:
        """
        Hybrid search: union of FAISS and BM25 results, deduplicated.

        Returns list of dicts with keys: 'text', 'metadata', 'score', 'source'.
        """
        if not self.chunk_texts:
            return []

        results: dict[int, dict] = {}  # chunk_index → result

        # --- FAISS dense retrieval ---
        if self.faiss_index is not None and self.faiss_index.ntotal > 0:
            query_embedding = self.embedding_client.embed_query(query)
            query_np = np.array([query_embedding], dtype=np.float32)
            faiss.normalize_L2(query_np)

            k = min(top_k, self.faiss_index.ntotal)
            scores, indices = self.faiss_index.search(query_np, k)

            for score, idx in zip(scores[0], indices[0]):
                if idx == -1:
                    continue
                idx = int(idx)
                results[idx] = {
                    "text": self.chunk_texts[idx],
                    "metadata": self.chunks_metadata[idx],
                    "score": float(score),
                    "source": "faiss",
                }

        # --- BM25 sparse retrieval ---
        if self.bm25 is not None:
            tokenized_query = query.lower().split()
            bm25_scores = self.bm25.get_scores(tokenized_query)
            top_indices = np.argsort(bm25_scores)[::-1][:top_k]

            for idx in top_indices:
                idx = int(idx)
                if bm25_scores[idx] <= 0:
                    continue
                if idx not in results:
                    results[idx] = {
                        "text": self.chunk_texts[idx],
                        "metadata": self.chunks_metadata[idx],
                        "score": float(bm25_scores[idx]),
                        "source": "bm25",
                    }
                else:
                    # Boost score if found by both methods
                    results[idx]["score"] += float(bm25_scores[idx])
                    results[idx]["source"] = "hybrid"

        # Sort by combined score descending
        sorted_results = sorted(results.values(), key=lambda x: x["score"], reverse=True)
        return sorted_results[:top_k]

    @property
    def has_index(self) -> bool:
        """Check if this segment has any indexed data."""
        return bool(self.chunk_texts)
