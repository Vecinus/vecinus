from fastapi import FastAPI
from api.transcription.minutes import router as minutes_router

app = FastAPI(title="Vecinus API")

app.include_router(minutes_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
