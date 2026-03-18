import cloudinary
import cloudinary.uploader
from api.chat.chat_helpers import verify_association_admin, verify_association_membership
from core.config import settings
from core.deps import get_current_user, get_supabase
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from schemas.incidents.incidents import Incident
from supabase import Client

router = APIRouter(prefix="/incidents", tags=["incidents"])
cloudinary.config(cloudinary_url=settings.CLOUDINARY_URL, secure=True)

ALLOWED_STATUSES = {"PENDING", "IN PROGRESS", "SOLVED", "DISCARDED"}
ALLOWED_TYPES = {"LIGHTING", "ELECTRICITY", "ELEVATOR", "PLUMBING", "SAFETY", "WORKERS", "POOL", "OTHER"}

STATUS_ALIASES = {
    "OPEN": "PENDING",
    "IN_PROGRESS": "IN PROGRESS",
    "RESOLVED": "SOLVED",
}

def check_status(status: str):
    normalized_status = STATUS_ALIASES.get((status or "").strip().upper(), (status or "").strip().upper())
    if normalized_status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed values: {ALLOWED_STATUSES}")
    return normalized_status

def check_type(type: str):
    normalized_type = (type or "").strip().upper()
    if normalized_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid incident type. Allowed values: {ALLOWED_TYPES}")
    return normalized_type

def get_latest_state(supabase: Client, incident_id: str) -> dict[str, dict]:
    if not incident_id:
        return {}

    states_res = (
        supabase.table("incident_states")
        .select("incident_id, status, created_at")
        .eq("incident_id", incident_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    return states_res.data[0] if states_res.data else {}

@router.get("/{association_id}", response_model=list[Incident])
def get_incidents(
    association_id: str,
    request: Request, ### CAMBIO: Inyectar Request
    status: str = None,
    mine: bool = False,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # ### CAMBIO: Autenticar el cliente de Supabase con el token del usuario
    auth_header = request.headers.get("Authorization")
    if auth_header:
        supabase.postgrest.auth(auth_header.split(" ")[1])

    user_id = current_user["id"]
    verify_association_membership(association_id, user_id, supabase)
    if status == "DISCARDED":
        verify_association_admin(association_id, user_id, supabase)

    incidents_res = supabase.table("incidents").select("""
                id,
                type,
                description,
                created_at,
                image_url,
                membership_id,
                memberships(association_id, role)
                """).eq("memberships.association_id", association_id).execute()
    
    # ... resto de la lógica de filtrado se mantiene igual ...
    incidents = incidents_res.data or []
    filtered_incidents = []
    for incident in incidents:
        latest_state = get_latest_state(supabase, incident["id"])
        normalized_latest_status = check_status(latest_state.get("status") or "PENDING")
        membership_data = incident.get("memberships") or {}
        membership_role = membership_data.get("role") if isinstance(membership_data, dict) else None

        if normalized_latest_status == "DISCARDED" and (membership_role != 1 or not mine):
            continue

        incident["status"] = normalized_latest_status
        filtered_incidents.append(incident)

    incidents = filtered_incidents

    if status:
        normalized_status = check_status(status)
        incidents = [incident for incident in incidents if incident.get("status") == normalized_status]

    if mine:
        membership_res = (
            supabase.table("memberships")
            .select("id")
            .eq("association_id", association_id)
            .eq("profile_id", user_id)
            .execute()
        )
        if not membership_res.data:
            raise HTTPException(status_code=404, detail="Membership not found in this community")
        membership_id = membership_res.data[0].get("id")
        incidents = [incident for incident in incidents if incident.get("membership_id") == membership_id]

    return incidents


@router.get("/{association_id}/{incident_id}", response_model=Incident)
def get_incident(
    association_id: str,
    incident_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    user_id = current_user["id"]
    verify_association_membership(association_id, user_id, supabase)

    incident_res = supabase.table("incidents").select("""
                id,
                type,
                description,
                created_at,
                image_url,
                membership_id,
                incident_states(status, created_at)
                """).eq("id", incident_id).execute()
    if not incident_res.data:
        raise HTTPException(status_code=404, detail="Incident not found")

    incident = incident_res.data[0]

    return incident


@router.post("/{association_id}")
def create_incident(
    association_id: str,
    request: Request, 
    incident_type: str = Form(..., alias="type"),
    description: str | None = Form(None),
    file: UploadFile | None = File(None),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # ### CAMBIO CRUCIAL: Pasar el token al cliente de Supabase
    auth_header = request.headers.get("Authorization")
    if auth_header:
        token = auth_header.split(" ")[1]
        supabase.postgrest.auth(token)

    normalized_type = check_type(incident_type)
    user_id = current_user["id"]
    
    membership_res = (
        supabase.table("memberships")
        .select("id, role")
        .eq("association_id", association_id)
        .eq("profile_id", user_id)
        .execute()
    )
    
    if not membership_res.data:
        raise HTTPException(status_code=403, detail="User has no access to this association")
    elif membership_res.data[0].get("role") == 1:
        raise HTTPException(status_code=403, detail="Admins cannot create incidents")

    membership_id = membership_res.data[0].get("id")

    image_url = None
    if file:
        try:
            if not settings.CLOUDINARY_URL:
                print("⚠️ CLOUDINARY_URL no configurado, guardando incidencia sin imagen")
            else:
                upload = cloudinary.uploader.upload(file.file, folder=f"incidents/{association_id}")
                image_url = upload.get("secure_url")
                print(f"✅ Imagen subida a Cloudinary: {image_url}")
        except Exception as e:
            print(f"❌ Error subiendo imagen a Cloudinary: {e}")
            # Continúa sin imagen si falla

    # Al ejecutar esto, Postgres usará el token para validar las políticas RLS
    new_incident = (
        supabase.table("incidents")
        .insert({
            "type": normalized_type,
            "description": description,
            "image_url": image_url,
            "membership_id": membership_id,
        })
        .execute()
    )
    
    if not new_incident.data:
        raise HTTPException(status_code=500, detail="Failed to create incident in database")

    incident_id = new_incident.data[0].get("id")

    # También necesitamos RLS para incident_states
    supabase.table("incident_states").insert({
        "incident_id": incident_id, 
        "status": "PENDING"
    }).execute()

    return {"message": "Incident created successfully", "incident_id": incident_id}

@router.post("/{association_id}/{incident_id}/status")
def update_incident_status(
    association_id: str,
    incident_id: str,
    status: str,
    request: Request, ### CAMBIO: Inyectar Request
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # ### CAMBIO: Autenticar cliente
    auth_header = request.headers.get("Authorization")
    if auth_header:
        supabase.postgrest.auth(auth_header.split(" ")[1])

    normalized_status = check_status(status)
    user_id = current_user["id"]
    verify_association_admin(association_id, user_id, supabase)
    
    latest_state = get_latest_state(supabase, incident_id)
    latest_status = check_status(latest_state.get("status") or "PENDING")
    
    if latest_status not in {"PENDING", "IN PROGRESS"}:
        raise HTTPException(status_code=400, detail="Cannot update status of a resolved or discarded incident")
    elif latest_status == normalized_status:
        raise HTTPException(status_code=400, detail=f"Incident is already in {normalized_status} status")

    supabase.table("incident_states").insert({"incident_id": incident_id, "status": normalized_status}).execute()
    return {
        "message": "Incident status updated successfully",
        "incident_id": incident_id,
        "old_status": latest_status,
        "new_status": normalized_status,
    }