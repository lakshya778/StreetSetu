from pydantic import BaseModel

class IssueClassificationRequest(BaseModel):
    issue_id: str
    text: str

class IssueClassificationResult(BaseModel):
    category: str
    duplicate_score: float
    priority_score: float
    summary: str
