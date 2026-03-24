from io import BytesIO
from typing import List
from uuid import UUID

from fastapi import HTTPException
from core.config import settings
from schemas.common_space import CommonSpaceCreate, CommonSpaceUpdate
from supabase import Client

try:
    import cloudinary
    import cloudinary.uploader
except ImportError:  # pragma: no cover - handled at runtime if dependency is missing
    cloudinary = None

TABLE_NAME = "common_space"


def create_common_space(supabase: Client, payload: CommonSpaceCreate, association_id: UUID) -> dict:
    insert_data = payload.model_dump(exclude_none=True)
    insert_data["association_id"] = str(association_id)

    response = supabase.table(TABLE_NAME).insert(insert_data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="No se ha podido crear la zona común")

    return response.data[0]


def list_common_spaces(supabase: Client, association_id: UUID) -> List[dict]:
    response = (
        supabase.table(TABLE_NAME)
        .select("*")
        .eq("association_id", str(association_id))
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []


def get_common_space_by_id(supabase: Client, association_id: UUID, common_space_id: int) -> dict:
    response = (
        supabase.table(TABLE_NAME)
        .select("*")
        .eq("association_id", str(association_id))
        .eq("id", common_space_id)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="No se ha encontrado la zona común")

    return response.data[0]


def update_common_space(supabase: Client, association_id: UUID, common_space_id: int, payload: CommonSpaceUpdate) -> dict:
    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No se han proporcionado campos para actualizar")

    response = (
        supabase.table(TABLE_NAME)
        .update(update_data)
        .eq("association_id", str(association_id))
        .eq("id", common_space_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="No se ha encontrado la zona común")

    return response.data[0]


def delete_common_space(supabase: Client, association_id: UUID, common_space_id: int) -> None:
    response = (
        supabase.table(TABLE_NAME)
        .delete()
        .eq("association_id", str(association_id))
        .eq("id", common_space_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="No se ha encontrado la zona común")


def upload_common_space_photo(file_bytes: bytes, filename: str, content_type: str | None = None) -> dict:
    if cloudinary is None:
        raise HTTPException(status_code=500, detail="La dependencia de Cloudinary no está instalada")

    if not settings.CLOUDINARY_URL:
        raise HTTPException(status_code=500, detail="Cloudinary no está configurado")

    cloudinary.config(
        cloudinary_url=settings.CLOUDINARY_URL,
        secure=True,
    )

    upload_options = {
        "folder": "vecinus/common-spaces",
        "resource_type": "image",
        "use_filename": True,
        "unique_filename": True,
    }
    if content_type:
        upload_options["format"] = content_type.split("/")[-1]

    result = cloudinary.uploader.upload(
        BytesIO(file_bytes),
        public_id=filename.rsplit(".", 1)[0],
        **upload_options,
    )

    secure_url = result.get("secure_url")
    if not secure_url:
        raise HTTPException(status_code=500, detail="Cloudinary no devolvió una URL segura")

    return {"secure_url": secure_url}
