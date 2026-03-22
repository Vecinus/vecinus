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


def _resolve_association_id(payload: CommonSpaceCreate, association_id: UUID | None = None) -> str:
    resolved_association_id = association_id or payload.association_id
    if not resolved_association_id:
        raise HTTPException(status_code=400, detail="association_id is required")
    return str(resolved_association_id)


def create_common_space(supabase: Client, payload: CommonSpaceCreate, association_id: UUID | None = None) -> dict:
    insert_data = payload.model_dump(exclude_none=True)
    insert_data["association_id"] = _resolve_association_id(payload, association_id)

    response = supabase.table(TABLE_NAME).insert(insert_data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create common space")

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
        raise HTTPException(status_code=404, detail="Common space not found")

    return response.data[0]


def update_common_space(supabase: Client, association_id: UUID, common_space_id: int, payload: CommonSpaceUpdate) -> dict:
    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    response = (
        supabase.table(TABLE_NAME)
        .update(update_data)
        .eq("association_id", str(association_id))
        .eq("id", common_space_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Common space not found")

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
        raise HTTPException(status_code=404, detail="Common space not found")


def upload_common_space_photo(file_bytes: bytes, filename: str, content_type: str | None = None) -> dict:
    if cloudinary is None:
        raise HTTPException(status_code=500, detail="Cloudinary dependency is not installed")

    if not (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    ):
        raise HTTPException(status_code=500, detail="Cloudinary is not configured")

    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
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
        raise HTTPException(status_code=500, detail="Cloudinary upload did not return a secure URL")

    return {"secure_url": secure_url}
