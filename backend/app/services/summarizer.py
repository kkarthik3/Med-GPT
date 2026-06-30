"""Medical report summarization via LiteLLM + Ollama."""

from openai import base_url
import logging

import litellm

from app.config import NVIDIA_API_KEY, NVIDIA_NIM_MODEL, NVIDIA_NIM_API_BASE
from app.config import GROQ_API_KEY, GROQ_MODEL

logger = logging.getLogger(__name__)

MEDICAL_SUMMARY_PROMPT = """You are an expert medical report analyst. Analyze the following medical documents and provide a comprehensive, structured medical summary.

## Instructions
- Identify and extract key medical information
- Organize findings into clear sections
- Highlight critical values, abnormalities, or concerns
- Use medical terminology appropriately but keep it understandable
- Note any missing or incomplete information

## Required Summary Sections
1. **Patient Overview** — Demographics and general information (if available)
2. **Chief Complaints / Reason for Visit** — Why the patient sought care
3. **Key Findings** — Important test results, vital signs, observations
4. **Abnormal Values** — Any values outside normal ranges (flagged)
5. **Diagnosis / Assessment** — Identified or suspected conditions
6. **Treatment Plan / Medications** — Prescribed treatments, medications, dosages
7. **Recommendations** — Follow-up actions, lifestyle changes, additional tests
8. **Critical Alerts** — Any urgent or critical findings requiring immediate attention

---

## Medical Documents:
{document_text}

---

Provide the structured medical summary below:"""


async def summarize_medical_report(document_text: str) -> str:
    """
    Generate a medical summary from document text using Ollama via LiteLLM.

    Args:
        document_text: Concatenated text from all parsed documents.

    Returns:
        Structured medical summary string.
    """
    prompt = MEDICAL_SUMMARY_PROMPT.format(document_text=document_text)

    try:
        response = await litellm.acompletion(
            model=GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a medical AI assistant specialized in analyzing "
                        "and summarizing medical reports, lab results, and clinical documents."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=8192,
        )
        return response.choices[0].message.content

    except Exception as e:
        logger.error(f"Summarization failed: {e}")
        raise RuntimeError(f"Failed to generate medical summary: {e}") from e


async def generate_chat_response(
    query: str,
    context: str,
    chat_history: list[dict] | None = None,
) -> str:
    """
    Generate a RAG-based chat response using context and conversation history.

    Args:
        query: The user's question.
        context: Retrieved and reranked document chunks.
        chat_history: Previous conversation messages [{role, content}, ...].

    Returns:
        The assistant's response string.
    """
    system_prompt = (
        "You are a medical AI assistant. Answer questions based on the provided "
        "medical document context. Be accurate, helpful, and cite specific "
        "information from the documents when possible. If the context doesn't "
        "contain enough information to answer, say so clearly."
    )

    messages = [{"role": "system", "content": system_prompt}]

    # Add chat history for conversational context
    if chat_history:
        for msg in chat_history[-10:]:  # Last 10 messages for context window
            messages.append({"role": msg["role"], "content": msg["content"]})

    # Add the context + query
    user_message = f"""## Relevant Document Context:
{context}

---

## User Question:
{query}

Provide a detailed, accurate answer based on the document context above."""

    messages.append({"role": "user", "content": user_message})

    try:
        response = await litellm.acompletion(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.4,
            max_tokens=8192,
        )
        return response.choices[0].message.content

    except Exception as e:
        logger.error(f"Chat generation failed: {e}")
        raise RuntimeError(f"Failed to generate chat response: {e}") from e
