"""Text normalization shared by training and inference."""

import re


def combine_text(title: str, description: str) -> str:
    """Build the model input while preserving useful word boundaries."""
    return f"{title or ''} {description or ''}".strip()


def normalize_text(text: str) -> str:
    """Normalize user text without removing domain-specific words."""
    text = str(text or '').lower()
    text = re.sub(r"https?://\S+|www\.\S+", " url ", text)
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()