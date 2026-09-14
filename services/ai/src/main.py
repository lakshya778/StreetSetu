from fastapi import FastAPI

app = FastAPI(title="StreetSetu AI Service")

@app.get("/health")
async def health_check():
    return {"status": "ok"}
