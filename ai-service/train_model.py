"""Train and persist the StreetSetu complaint classifier."""

from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.multioutput import MultiOutputClassifier

from utils.preprocessing import combine_text, normalize_text


BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR / 'dataset.csv'


def train() -> None:
    dataset = pd.read_csv(DATASET_PATH)
    required_columns = {'title', 'description', 'category', 'priority'}
    missing = required_columns.difference(dataset.columns)
    if missing:
        raise ValueError(f'Missing dataset columns: {sorted(missing)}')

    text = dataset.apply(
        lambda row: normalize_text(combine_text(row['title'], row['description'])),
        axis=1,
    )
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1, sublinear_tf=True)
    features = vectorizer.fit_transform(text)
    targets = dataset[['category', 'priority']]
    model = MultiOutputClassifier(
        LogisticRegression(max_iter=1000, class_weight='balanced', random_state=42)
    )
    model.fit(features, targets)

    joblib.dump(model, BASE_DIR / 'model.pkl')
    joblib.dump(vectorizer, BASE_DIR / 'vectorizer.pkl')
    print(f'Trained on {len(dataset)} complaints and saved model artifacts.')


if __name__ == '__main__':
    train()