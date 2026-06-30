"""Document parser — extracts text from PDF, DOCX, CSV, and Excel files."""

from pathlib import Path

import pandas as pd
from pypdf import PdfReader
from docx import Document as DocxDocument


def parse_pdf(filepath: str | Path) -> str:
    """Extract text from a PDF file."""
    reader = PdfReader(str(filepath))
    pages: list[str] = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if text.strip():
            pages.append(f"[Page {i + 1}]\n{text}")
    return "\n\n".join(pages)


def parse_docx(filepath: str | Path) -> str:
    """Extract text from a DOCX file."""
    doc = DocxDocument(str(filepath))
    paragraphs: list[str] = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            paragraphs.append(text)

    # Also extract text from tables
    for table in doc.tables:
        for row in table.rows:
            row_text = "\t".join(cell.text.strip() for cell in row.cells)
            if row_text.strip():
                paragraphs.append(row_text)

    return "\n\n".join(paragraphs)


def parse_csv(filepath: str | Path) -> str:
    """Extract text from a CSV file — converts to readable tabular string."""
    df = pd.read_csv(str(filepath))
    return _dataframe_to_text(df, filepath)


def parse_excel(filepath: str | Path) -> str:
    """Extract text from an Excel file (all sheets)."""
    xls = pd.ExcelFile(str(filepath), engine="openpyxl")
    sections: list[str] = []
    for sheet_name in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet_name)
        sections.append(f"[Sheet: {sheet_name}]\n{_dataframe_to_text(df, filepath)}")
    return "\n\n".join(sections)


def _dataframe_to_text(df: pd.DataFrame, filepath: str | Path) -> str:
    """Convert a DataFrame to a human-readable text block."""
    lines: list[str] = []
    columns = list(df.columns)
    lines.append("Columns: " + ", ".join(str(c) for c in columns))
    lines.append(f"Total rows: {len(df)}")
    lines.append("")

    for idx, row in df.iterrows():
        row_parts = [f"{col}: {row[col]}" for col in columns]
        lines.append(f"Row {idx + 1}: " + " | ".join(str(p) for p in row_parts))

    return "\n".join(lines)


def parse_file(filepath: str | Path) -> str:
    """
    Dispatch parser based on file extension.

    Supported: .pdf, .docx, .csv, .xlsx, .xls
    Raises ValueError for unsupported types.
    """
    filepath = Path(filepath)
    ext = filepath.suffix.lower()

    parsers = {
        ".pdf": parse_pdf,
        ".docx": parse_docx,
        ".csv": parse_csv,
        ".xlsx": parse_excel,
        ".xls": parse_excel,
    }

    parser = parsers.get(ext)
    if parser is None:
        # Attempt to read as plain text
        try:
            return filepath.read_text(encoding="utf-8")
        except Exception:
            raise ValueError(
                f"Unsupported file type: '{ext}'. "
                f"Supported: {', '.join(parsers.keys())}"
            )

    return parser(filepath)
