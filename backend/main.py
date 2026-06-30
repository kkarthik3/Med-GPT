"""MedGPT — Medical Report Summarization & RAG Chatbot Backend.

FastAPI application entry point.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import create_tables
from app.config import UPLOAD_DIR, DATA_DIR
from app.routers import upload, summarize, chat

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-8s │ %(name)s │ %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("medgpt")


# ─── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("🚀 Starting MedGPT Backend...")

    # Create directories
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Create database tables
    create_tables()
    logger.info("✅ Database tables created")
    logger.info(f"📁 Upload directory: {UPLOAD_DIR}")
    logger.info(f"💾 Database directory: {DATA_DIR}")

    yield

    logger.info("🛑 MedGPT Backend shutting down...")


# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="MedGPT",
    description=(
        "Medical Report Summarization & RAG-based Chatbot API.\n\n"
        "**Endpoints:**\n"
        "- `/api/upload/` — Upload medical documents (PDF, DOCX, CSV, Excel)\n"
        "- `/api/summarize/` — Generate structured medical summaries\n"
        "- `/api/chat/` — RAG-powered Q&A over uploaded documents\n"
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(upload.router, prefix="/api")
app.include_router(summarize.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    """Health check endpoint."""
    return {
        "service": "MedGPT",
        "status": "healthy",
        "version": "0.1.0",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "components": {
            "database": "connected",
            "upload_dir": str(UPLOAD_DIR),
        },
    }
