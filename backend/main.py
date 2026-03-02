from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.chatBot.chatBot import router as chatBotRouter
from backend.api.chatBot.documents import router as documentsRouter

app = FastAPI()
# ESTO ES VITAL PARA QUE REACT NATIVE (O CUALQUIER FRONTEND) PUEDA CONECTARSE
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(chatBotRouter)
app.include_router(documentsRouter)


@app.get("/health")
def health():
    return {"status": "ok", "message": "Backend funcionando perfectamente"}
