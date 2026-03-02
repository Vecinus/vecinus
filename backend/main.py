from api.alerts import router as alerts_router
from api.associations import router as associations_router
from api.chat import router as chat_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.chatBot.chatBot import router as chatBotRouter
from backend.api.chatBot.documents import router as documentsRouter

app = FastAPI(
    title="Vecinus API",
    description="Backend API for community management (Chat & Alerts)",
    version="1.0.0",
)

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Debería ser limitado en producción
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chatBotRouter)
app.include_router(documentsRouter)
app.include_router(chat_router)
app.include_router(alerts_router)
app.include_router(associations_router)


@app.get("/health")
def health():
    return {"status": "ok", "message": "Backend funcionando perfectamente"}
