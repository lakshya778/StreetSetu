"""Model loading and classification helpers."""

from pathlib import Path
from typing import Any

import joblib

from .preprocessing import combine_text, normalize_text


MODEL_DIR = Path(__file__).resolve().parent.parent


class ComplaintClassifier:
    """Load the persisted vectorizer and multi-output classifier once."""

    def __init__(self, model_path: Path | None = None, vectorizer_path: Path | None = None):
        self.model = joblib.load(model_path or MODEL_DIR / 'model.pkl')
        self.vectorizer = joblib.load(vectorizer_path or MODEL_DIR / 'vectorizer.pkl')

    def classify(self, title: str, description: str) -> dict[str, Any]:
        text = normalize_text(combine_text(title, description))
        features = self.vectorizer.transform([text])
        prediction = self.model.predict(features)[0]
        probabilities = self.model.predict_proba(features)
        confidence = min(float(max(probability[0])) for probability in probabilities)
        return {
            'category': str(prediction[0]),
            'priority': str(prediction[1]),
            'confidence': round(confidence, 4),
        }