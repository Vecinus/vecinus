import logging
from datetime import datetime, timezone
from io import BytesIO

from core.config import settings
from core.deps import get_current_user, get_supabase, get_supabase_admin, require_active_community
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi import status as http_status
from PIL import Image, UnidentifiedImageError
from schemas.announcements.announcements import AnnouncementResponse
from supabase import Client

try:
    import cloudinary
    import cloudinary.uploader
except ImportError:  # pragma: no cover - handled at runtime if dependency is missing
    cloudinary = None

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/announcements", tags=["announcements"])

ALLOWED_STATUSES = {"DRAFT", "PUBLISHED"}
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_ANNOUNCEMENT_IMAGE_BYTES = 5 * 1024 * 1024


def check_status(status_val: str):
    if status_val and status_val not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed values: {ALLOWED_STATUSES}")


def read_announcement_image(file: UploadFile) -> bytes:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Formato de imagen no soportado")

    file_content = file.file.read(MAX_ANNOUNCEMENT_IMAGE_BYTES + 1)
    if len(file_content) > MAX_ANNOUNCEMENT_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="La imagen es demasiado grande")
    if not file_content:
        raise HTTPException(status_code=400, detail="El archivo de imagen esta vacio.")

    try:
        Image.open(BytesIO(file_content)).verify()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(status_code=415, detail="El archivo no es una imagen valida") from exc

    return file_content


@router.get(
    "/{association_id}", response_model=list[AnnouncementResponse], dependencies=[Depends(require_active_community)]
)
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

    # Publish any scheduled announcements that are due
    _publish_scheduled(supabase_admin, str(association_id))

    query = supabase_admin.table("announcements").select("*").eq("association_id", str(association_id))
    if query_status:
        check_status(query_status)
        query = query.eq("status", query_status)

    announcements_res = query.order("created_at", desc=True).execute()

    return announcements_res.data or []


def _publish_scheduled(supabase_admin: Client, association_id: str):
    """Publish any DRAFT announcements whose scheduled_date has passed."""
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        due = (
            supabase_admin.table("announcements")
            .select("id")
            .eq("association_id", association_id)
            .eq("status", "DRAFT")
            .not_.is_("scheduled_date", "null")
            .lte("scheduled_date", now_iso)
            .execute()
        )
        for row in due.data or []:
            supabase_admin.table("announcements").update({"status": "PUBLISHED", "updated_at": now_iso}).eq(
                "id", row["id"]
            ).execute()
    except Exception as e:
        # Non-fatal — just log it; don't break the main request
        logger.warning(f"_publish_scheduled failed: {e}")


@router.get(
    "/{association_id}/{announcement_id}",
    response_model=AnnouncementResponse,
    dependencies=[Depends(require_active_community)],
)
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

    # Publish scheduled announcements before returning detail
    _publish_scheduled(supabase_admin, str(association_id))

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


@router.post(
    "/{association_id}",
    response_model=AnnouncementResponse,
    status_code=http_status.HTTP_201_CREATED,
    dependencies=[Depends(require_active_community)],
)
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

    if file and file.filename:
        try:
            file_content = read_announcement_image(file)
            if cloudinary is None:
                raise HTTPException(status_code=500, detail="La dependencia de Cloudinary no está instalada")
            if not settings.CLOUDINARY_URL:
                raise HTTPException(status_code=500, detail="Cloudinary no está configurado")

            cloudinary.config(cloudinary_url=settings.CLOUDINARY_URL, secure=True)

            upload_options = {
                "folder": f"announcements/{association_id}",
                "resource_type": "image",
                "use_filename": True,
                "unique_filename": True,
            }

            upload = cloudinary.uploader.upload(BytesIO(file_content), **upload_options)
            image_url = upload.get("secure_url")
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=500, detail="Error al subir la imagen")

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

        new_announcement = supabase_admin.table("announcements").insert(insert_data).execute()

        if not new_announcement.data:
            raise HTTPException(status_code=500, detail="Error al crear el anuncio en la base de datos.")

        return new_announcement.data[0]

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error interno al crear el anuncio")


@router.put(
    "/{association_id}/{announcement_id}",
    response_model=AnnouncementResponse,
    dependencies=[Depends(require_active_community)],
)
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
        .select("id, status")
        .eq("id", announcement_id)
        .eq("association_id", str(association_id))
        .execute()
    )
    if not announcement_res.data:
        raise HTTPException(status_code=404, detail="Announcement not found")

    current_status = announcement_res.data[0].get("status")

    # Business rule: a PUBLISHED announcement cannot be reverted to DRAFT
    if current_status == "PUBLISHED" and status == "DRAFT":
        raise HTTPException(status_code=400, detail="Un anuncio publicado no puede volver a estado borrador.")

    # Business rule: scheduled_date only makes sense for DRAFT announcements
    # If the announcement is (or will be) PUBLISHED, ignore scheduled_date
    effective_status = status if status else current_status
    if effective_status == "PUBLISHED":
        scheduled_date = None

    update_data = {}
    if title is not None:
        update_data["title"] = title
    if content is not None:
        update_data["content"] = content
    if status is not None:
        update_data["status"] = status
    if scheduled_date is not None:
        update_data["scheduled_date"] = scheduled_date
    elif effective_status == "PUBLISHED":
        # Explicitly clear any lingering scheduled_date when publishing
        update_data["scheduled_date"] = None

    if file and file.filename:
        try:
            file_content = read_announcement_image(file)
            if cloudinary is None:
                raise HTTPException(status_code=500, detail="La dependencia de Cloudinary no está instalada")
            if not settings.CLOUDINARY_URL:
                raise HTTPException(status_code=500, detail="Cloudinary no está configurado")

            cloudinary.config(cloudinary_url=settings.CLOUDINARY_URL, secure=True)

            upload_options = {
                "folder": f"announcements/{association_id}",
                "resource_type": "image",
                "use_filename": True,
                "unique_filename": True,
            }

            upload = cloudinary.uploader.upload(BytesIO(file_content), **upload_options)
            update_data["image_url"] = upload.get("secure_url")
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=500, detail="Error al subir la imagen")

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
    except Exception:
        raise HTTPException(status_code=500, detail="Error interno al actualizar el anuncio")


@router.delete(
    "/{association_id}/{announcement_id}",
    status_code=http_status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_active_community)],
)
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
    except Exception:
        raise HTTPException(status_code=500, detail="Error interno al eliminar el anuncio")
