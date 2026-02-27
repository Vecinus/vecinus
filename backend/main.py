from fastapi import FastAPI
from backend.api.chatBot.chatBot import router as chatBotRouter
from backend.api.chatBot.documents import router as documentsRouter

app = FastAPI()

app.include_router(chatBotRouter)
app.include_router(documentsRouter)