from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.alerts import router as alerts_router
from api.associations import router as associations_router
from api.chat import router as chat_router

app = FastAPI(
    title="Vecinus API",
    description="Backend API for community management (Chat & Alerts)",
    version="1.0.0",
)

app.include_router(chat_router)
app.include_router(alerts_router)
app.include_router(associations_router)
# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Debería ser limitado en producción
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}
