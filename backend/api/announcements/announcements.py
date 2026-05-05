from datetime import datetime, timezone

import cloudinary
import cloudinary.uploader
from core.config import settings
from core.deps import get_current_user, get_supabase, get_supabase_admin
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi import status as http_status
from schemas.announcements.announcements import AnnouncementResponse
from supabase import Client

router = APIRouter(prefix="/announcements", tags=["announcements"])
cloudinary.config(cloudinary_url=settings.CLOUDINARY_URL, secure=True)

ALLOWED_STATUSES = {"DRAFT", "PUBLISHED"}


def check_status(status_val: str):
    if status_val and status_val not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed values: {ALLOWED_STATUSES}")


@router.get("/{association_id}", response_model=list[AnnouncementResponse])
def get_announcements(
    association_id: str,
    status: str = None,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    # 1. Validar acceso a la comunidad
    membership = (
        supabase.table("memberships")
        .select("role")
        .eq("profile_id", current_user["id"])
        .eq("association_id", str(association_id))
        .execute()
    )

    if not membership.data:
        raise HTTPException(status_code=403, detail="Error de permisos: No se encontró tu membresía en esta comunidad.")

    user_role = int(membership.data[0].get("role", 0))

    if user_role not in [1, 4]:
        if status == "DRAFT":
            raise HTTPException(status_code=403, detail="Normal users cannot view drafts")
        query_status = "PUBLISHED"
    else:
        query_status = status

    query = supabase_admin.table("announcements").select("*").eq("association_id", str(association_id))
    if query_status:
        check_status(query_status)
        query = query.eq("status", query_status)

    announcements_res = query.order("created_at", desc=True).execute()

    return announcements_res.data or []


@router.get("/{association_id}/{announcement_id}", response_model=AnnouncementResponse)
def get_announcement(
    association_id: str,
    announcement_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    # 1. Validar acceso a la comunidad
    membership = (
        supabase.table("memberships")
        .select("role")
        .eq("profile_id", current_user["id"])
        .eq("association_id", str(association_id))
        .execute()
    )

    if not membership.data:
        raise HTTPException(status_code=403, detail="Error de permisos: No se encontró tu membresía en esta comunidad.")

    user_role = int(membership.data[0].get("role", 0))

    announcement_res = (
        supabase_admin.table("announcements")
        .select("*")
        .eq("id", announcement_id)
        .eq("association_id", str(association_id))
        .execute()
    )

    if not announcement_res.data:
        raise HTTPException(status_code=404, detail="Announcement not found")

    announcement = announcement_res.data[0]

    if user_role not in [1, 4] and announcement.get("status") == "DRAFT":
        raise HTTPException(status_code=403, detail="Normal users cannot view drafts")

    return announcement


@router.post("/{association_id}", response_model=AnnouncementResponse, status_code=http_status.HTTP_201_CREATED)
def create_announcement(
    association_id: str,
    title: str = Form(...),
    content: str = Form(...),
    status: str = Form("DRAFT"),
    scheduled_date: str | None = Form(None),
    file: UploadFile | None = File(None),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    check_status(status)

    # 1. Validar permisos de administrador o presidente
    membership = (
        supabase.table("memberships")
        .select("id, role")
        .eq("profile_id", current_user["id"])
        .eq("association_id", str(association_id))
        .execute()
    )

    if not membership.data:
        raise HTTPException(status_code=403, detail="Error de permisos: No se encontró tu membresía en esta comunidad.")

    user_role = int(membership.data[0].get("role", 0))

    if user_role not in [1, 4]:
        raise HTTPException(status_code=403, detail="Acceso denegado. Se requiere ser Administrador o Presidente.")

    membership_id = membership.data[0]["id"]
    image_url = None

    if file:
        try:
            if not settings.CLOUDINARY_URL:
                raise HTTPException(status_code=500, detail="Cloudinary configuration is missing")
            else:
                upload = cloudinary.uploader.upload(file.file, folder=f"announcements/{association_id}")
                image_url = upload.get("secure_url")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

    try:
        # Usamos supabase_admin para insertar saltando RLS
        insert_data = {
            "association_id": str(association_id),
            "title": title,
            "content": content,
            "status": status,
            "image_url": image_url,
            "created_by": membership_id,
        }
        if scheduled_date:
            insert_data["scheduled_date"] = scheduled_date

        print(f"[DEBUG] Creating announcement with association_id={association_id}, membership_id={membership_id}")

        new_announcement = supabase_admin.table("announcements").insert(insert_data).execute()

        if not new_announcement.data:
            raise HTTPException(status_code=500, detail="Error al crear el anuncio en la base de datos.")

        return new_announcement.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno al crear el anuncio: {str(e)}")


@router.put("/{association_id}/{announcement_id}", response_model=AnnouncementResponse)
def update_announcement(
    association_id: str,
    announcement_id: str,
    title: str | None = Form(None),
    content: str | None = Form(None),
    status: str | None = Form(None),
    scheduled_date: str | None = Form(None),
    file: UploadFile | None = File(None),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    if status:
        check_status(status)

    # 1. Validar permisos de administrador o presidente
    membership = (
        supabase.table("memberships")
        .select("role")
        .eq("profile_id", current_user["id"])
        .eq("association_id", str(association_id))
        .execute()
    )

    if not membership.data:
        raise HTTPException(status_code=403, detail="Error de permisos: No se encontró tu membresía en esta comunidad.")

    user_role = int(membership.data[0].get("role", 0))

    if user_role not in [1, 4]:
        raise HTTPException(status_code=403, detail="Acceso denegado. Se requiere ser Administrador o Presidente.")

    # Validamos que el anuncio existe (usamos supabase_admin para saltar RLS)
    announcement_res = (
        supabase_admin.table("announcements")
        .select("id")
        .eq("id", announcement_id)
        .eq("association_id", str(association_id))
        .execute()
    )
    if not announcement_res.data:
        raise HTTPException(status_code=404, detail="Announcement not found")

    update_data = {}
    if title is not None:
        update_data["title"] = title
    if content is not None:
        update_data["content"] = content
    if status is not None:
        update_data["status"] = status
    if scheduled_date is not None:
        update_data["scheduled_date"] = scheduled_date

    if file:
        try:
            if not settings.CLOUDINARY_URL:
                raise HTTPException(status_code=500, detail="Cloudinary configuration is missing")
            else:
                upload = cloudinary.uploader.upload(file.file, folder=f"announcements/{association_id}")
                update_data["image_url"] = upload.get("secure_url")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

    if not update_data:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="No fields to update provided")

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        # Usamos supabase_admin para actualizar
        updated = supabase_admin.table("announcements").update(update_data).eq("id", announcement_id).execute()

        if not updated.data:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND, detail="Propiedad no encontrada o no se pudo actualizar"
            )

        return updated.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno al actualizar el anuncio: {str(e)}")


@router.delete("/{association_id}/{announcement_id}", status_code=http_status.HTTP_204_NO_CONTENT)
def delete_announcement(
    association_id: str,
    announcement_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    # 1. Validar permisos de administrador o presidente
    membership = (
        supabase.table("memberships")
        .select("role")
        .eq("profile_id", current_user["id"])
        .eq("association_id", str(association_id))
        .execute()
    )

    if not membership.data:
        raise HTTPException(status_code=403, detail="Error de permisos: No se encontró tu membresía en esta comunidad.")

    user_role = int(membership.data[0].get("role", 0))

    if user_role not in [1, 4]:
        raise HTTPException(status_code=403, detail="Acceso denegado. Se requiere ser Administrador o Presidente.")

    announcement_res = (
        supabase_admin.table("announcements")
        .select("id")
        .eq("id", announcement_id)
        .eq("association_id", str(association_id))
        .execute()
    )
    if not announcement_res.data:
        raise HTTPException(status_code=404, detail="Announcement not found")

    try:
        # Usamos supabase_admin para el delete
        delete_res = supabase_admin.table("announcements").delete().eq("id", announcement_id).execute()

        if not delete_res.data:
            raise HTTPException(status_code=500, detail="No se pudo eliminar el registro de la base de datos")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno al eliminar el anuncio: {str(e)}")
