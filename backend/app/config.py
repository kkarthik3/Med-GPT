"""Application configuration loaded from environment variables."""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# --- Base Paths ---
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
FAISS_DIR = DATA_DIR / "faiss"

# --- NVIDIA AI ---
NVIDIA_API_KEY: str = os.getenv("NVIDIA_API_KEY", "")
os.environ['NVIDIA_NIM_API_KEY'] = NVIDIA_API_KEY
os.environ['NVIDIA_NIM_API_BASE'] = "https://integrate.api.nvidia.com/v1/"
NVIDIA_NIM_API_BASE = "https://integrate.api.nvidia.com/v1/"
NVIDIA_EMBED_MODEL: str = "nvidia/nv-embedcode-7b-v1"
NVIDIA_RERANK_MODEL: str = "nvidia/llama-nemotron-rerank-vl-1b-v2"
NVIDIA_RERANK_URL: str = (
    "https://ai.api.nvidia.com/v1/retrieval/nvidia/llama-nemotron-rerank-vl-1b-v2/reranking"
)

# --- Ollama / LiteLLM ---
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
NVIDIA_NIM_MODEL:str = os.getenv("NVIDIA_NIM_MODEL","nvidia_nim/meta/llama3-70b-instruct")

# --- Database ---
DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'medgpt.db'}")

# --- Uploads ---
UPLOAD_DIR: Path = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "app" / "uploads")))

# --- RAG Settings ---
CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "500"))
CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "100"))
TOP_K_RETRIEVAL: int = int(os.getenv("TOP_K_RETRIEVAL", "20"))
TOP_K_RERANK: int = int(os.getenv("TOP_K_RERANK", "5"))

#__GROQ__
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "")

# --- Ensure directories exist ---
DATA_DIR.mkdir(parents=True, exist_ok=True)
FAISS_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
