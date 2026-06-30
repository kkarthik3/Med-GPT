"""Upload router — handles file uploads grouped by segment_id."""

import shutil
from pathlib import Path

from fastapi import APIRouter, File, Form, UploadFile, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import UPLOAD_DIR
from app.database import get_db
from app import models
from app.schemas import UploadResponse, FileOut

router = APIRouter(prefix="/upload", tags=["Upload"])


@router.post("/", response_model=UploadResponse)
async def upload_files(
    segment_id: str = Form(..., description="Segment ID to group files under"),
    files: list[UploadFile] = File(..., description="Files to upload"),
    db: Session = Depends(get_db),
):
    """
    Upload one or more files to a segment.

    Files are saved to disk and tracked in the database.
    Supported formats: PDF, DOCX, CSV, XLSX, XLS, TXT.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    # Create segment if it doesn't exist
    segment = (
        db.query(models.Segment)
        .filter(models.Segment.segment_id == segment_id)
        .first()
    )
    if segment is None:
        segment = models.Segment(segment_id=segment_id)
        db.add(segment)
        db.commit()
        db.refresh(segment)

    # Create upload directory for this segment
    segment_dir = UPLOAD_DIR / segment_id
    segment_dir.mkdir(parents=True, exist_ok=True)

    uploaded_files: list[FileOut] = []
    allowed_extensions = {".pdf", ".docx", ".csv", ".xlsx", ".xls", ".txt"}

    for upload_file in files:
        # Validate extension
        filename = upload_file.filename or "unknown"
        ext = Path(filename).suffix.lower()
        if ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: '{ext}' for file '{filename}'. "
                       f"Allowed: {', '.join(allowed_extensions)}",
            )

        # Save file to disk
        filepath = segment_dir / filename
        with open(filepath, "wb") as f:
            content = await upload_file.read()
            f.write(content)

        # Check if file already exists in DB for this segment
        existing = (
            db.query(models.File)
            .filter(
                models.File.segment_id == segment_id,
                models.File.filename == filename,
            )
            .first()
        )

        if existing:
            # Re-upload: reset parsing status
            existing.is_parsed = False
            existing.filepath = str(filepath)
            db.commit()
            db.refresh(existing)
            uploaded_files.append(
                FileOut(
                    id=existing.id,
                    filename=existing.filename,
                    file_type=existing.file_type,
                    is_parsed=existing.is_parsed,
                )
            )
        else:
            # New file
            file_record = models.File(
                segment_id=segment_id,
                filename=filename,
                filepath=str(filepath),
                file_type=ext.lstrip("."),
                is_parsed=False,
            )
            db.add(file_record)
            db.commit()
            db.refresh(file_record)
            uploaded_files.append(
                FileOut(
                    id=file_record.id,
                    filename=file_record.filename,
                    file_type=file_record.file_type,
                    is_parsed=file_record.is_parsed,
                )
            )

    return UploadResponse(segment_id=segment_id, files=uploaded_files)


@router.get("/segments")
def list_segments(db: Session = Depends(get_db)):
    """List all segments with file counts."""
    segments = db.query(models.Segment).all()
    result = []
    for seg in segments:
        file_count = (
            db.query(models.File)
            .filter(models.File.segment_id == seg.segment_id)
            .count()
        )
        parsed_count = (
            db.query(models.File)
            .filter(
                models.File.segment_id == seg.segment_id,
                models.File.is_parsed == True,  # noqa: E712
            )
            .count()
        )
        result.append({
            "segment_id": seg.segment_id,
            "file_count": file_count,
            "parsed_count": parsed_count,
            "created_at": seg.created_at,
        })
    return result


@router.get("/segments/{segment_id}/files")
def list_segment_files(segment_id: str, db: Session = Depends(get_db)):
    """List all files in a segment."""
    files = (
        db.query(models.File)
        .filter(models.File.segment_id == segment_id)
        .all()
    )
    return [
        FileOut(
            id=f.id,
            filename=f.filename,
            file_type=f.file_type,
            is_parsed=f.is_parsed,
        )
        for f in files
    ]
