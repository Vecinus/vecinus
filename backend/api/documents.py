from fastapi import APIRouter, Body
from pydantic import BaseModel
from backend.services.documents_ChatBotService import index_document

router = APIRouter(prefix="/comunities", tags=["documents"])

class DocumentIN(BaseModel):
    title: str
    content: str


@router.post("/{comunidad_id}/documents")
def upload_document(comunidad_id: int, document: DocumentIN = Body(...)):
    chunks = index_document(comunidad_id, document.title, document.content)
    return {"message": "Documento indexado", "chunks": chunks}