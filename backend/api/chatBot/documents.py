import io
from typing import Optional

import pypdf
from api.chat.chat_helpers import verify_association_admin
from core.deps import get_current_user, get_supabase
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from services.chatBot.documents_ChatBotService import delete_document, index_document, list_documents
from supabase import Client

router = APIRouter(prefix="/comunities", tags=["documents"])


@router.get("/{comunidad_id}/documents")
async def get_documents(
    comunidad_id: str,
    uploaded_by: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    path_comunidad_id = str(comunidad_id).strip()
    verify_association_admin(path_comunidad_id, current_user["id"], supabase)
    result = list_documents(path_comunidad_id, uploaded_by=uploaded_by, limit=limit)
    documents = [doc.get("document_title") for doc in result.get("documents", []) if doc.get("document_title")]
    return {"documents": documents}


@router.post("/{comunidad_id}/documents")
async def upload_document(
    comunidad_id: str,
    request: Request,
    file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    path_comunidad_id = str(comunidad_id).strip()
    verify_association_admin(path_comunidad_id, current_user["id"], supabase)
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        data = await request.json()
        title = data.get("title")
        content = data.get("content")

        if not title or not content:
            raise HTTPException(
                status_code=400,
                detail="Faltan campos 'title' o 'content' en el JSON.",
            )

        chunks = index_document(
            path_comunidad_id,
            title,
            content,
            uploaded_by=str(current_user["id"]),
            uploaded_by_email=current_user.get("email"),
            source_filename=title,
        )
        return {
            "message": f"Documento '{title}' indexado con exito",
            "chunks": chunks,
            "uploaded_by": str(current_user["id"]),
        }

    if "multipart/form-data" in content_type:
        if not file:
            raise HTTPException(status_code=400, detail="No se ha enviado un archivo valido.")

        texto_extraido = ""
        if file.filename.endswith(".txt"):
            contenido_bytes = await file.read()
            texto_extraido = contenido_bytes.decode("utf-8")
        elif file.filename.endswith(".pdf"):
            contenido_bytes = await file.read()
            lector_pdf = pypdf.PdfReader(io.BytesIO(contenido_bytes))
            for pagina in lector_pdf.pages:
                texto_pagina = pagina.extract_text()
                if texto_pagina:
                    texto_extraido += texto_pagina + "\n"
        else:
            raise HTTPException(status_code=400, detail="Formato no soportado. Sube un .txt o .pdf")

        if not texto_extraido.strip():
            raise HTTPException(
                status_code=400,
                detail="El documento esta vacio o no se pudo extraer el texto.",
            )

        chunks = index_document(
            path_comunidad_id,
            file.filename,
            texto_extraido,
            uploaded_by=str(current_user["id"]),
            uploaded_by_email=current_user.get("email"),
            source_filename=file.filename,
        )
        return {
            "message": f"Documento '{file.filename}' indexado con exito",
            "chunks": chunks,
            "uploaded_by": str(current_user["id"]),
        }

    raise HTTPException(
        status_code=400,
        detail="Content-Type no soportado. Usa JSON o Form-Data.",
    )


@router.delete("/{comunidad_id}/documents")
async def delete_document_by_title(
    comunidad_id: str,
    document_title: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    path_comunidad_id = str(comunidad_id).strip()
    verify_association_admin(path_comunidad_id, current_user["id"], supabase)

    result = delete_document(path_comunidad_id, document_title)
    if result["deleted_chunks"] == 0:
        raise HTTPException(status_code=404, detail="Document not found in this community")

    return {
        "message": f"Documento '{result['document_title']}' eliminado con exito",
        **result,
    }
