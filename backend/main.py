from api.associations.associations import router as associations_router
from api.auth.login import router as auth_router
from api.chat.alerts import router as alerts_router
from api.chat.chat import router as chat_router
from api.chatBot.chatBot import router as chatBotRouter
from api.chatBot.documents import router as documentsRouter
from api.common_space.common_space import router as common_space_router
from api.common_space.reservations import router as reservations_router
from api.feedback.feedback import router as feedback_router
from api.transcription.minutes import router as minutes_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
app.include_router(common_space_router)
app.include_router(reservations_router)
app.include_router(associations_router)
app.include_router(minutes_router)
app.include_router(auth_router)
app.include_router(feedback_router)


@app.get("/health")
def health():
    return {"status": "ok", "message": "Backend funcionando perfectamente"}
