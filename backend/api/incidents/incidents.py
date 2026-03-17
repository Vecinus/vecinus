import cloudinary
from api.chat.chat_helpers import verify_association_admin, verify_association_membership
from core.config import settings
from core.deps import get_current_user, get_supabase
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from schemas.incidents.incidents import Incident
from supabase import Client

router = APIRouter(prefix="/incidents", tags=["incidents"])
cloudinary.config(cloudinary_url=settings.CLOUDINARY_URL, secure=True)

ALLOWED_STATUSES = {"PENDING", "IN_PROGRESS", "RESOLVED", "DISCARDED"}
ALLOWED_TYPES = {"LIGHTING", "ELECTRICITY", "ELEVATOR", "PLUMBING", "SAFETY", "WORKERS", "POOL", "OTHER"}


def check_status(status: str):
    if status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed values: {ALLOWED_STATUSES}")


def check_type(type: str):
    if type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid incident type. Allowed values: {ALLOWED_TYPES}")


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
    status: str = None,
    mine: bool = False,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    user_id = current_user["id"]
    verify_association_membership(association_id, user_id, supabase)
    if status == "DISCARDED":
        verify_association_admin(association_id, user_id, supabase)

    incidents_res = supabase.table("incidents").select("""
                id,
                type,
                description,
                created_at,
                image,
                membership_id,
                memberships(association_id, role)
                """).eq("memberships.association_id", association_id).execute()
    incidents = incidents_res.data or []
    for incident in incidents:
        latest_state = get_latest_state(supabase, incident["id"])
        if latest_state.get("status") == "DISCARDED" and (incident.get("memberships", {}).get("role") != 1 or not mine):
            incidents.remove(incident)
        incident["status"] = (latest_state.get("status"), latest_state.get("created_at"))

    if status:
        check_status(status)
        incidents = [incident for incident in incidents if incident.get("status")[0] == status]

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
                image,
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
    body: Incident,
    file: UploadFile = None,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    check_status(body.status)
    check_type(body.type)

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

    image_url = None
    if file:
        upload = cloudinary.uploader.upload(file.file, folder=f"incidents/{association_id}")
        image_url = upload.get("secure_url")

    new_incident = (
        supabase.table("incidents")
        .insert(
            {
                "type": body.type,
                "description": body.description,
                "image": image_url,
                "membership_id": body.membership_id,
            }
        )
        .select("id")
        .single()
        .execute()
    )
    incident_id = new_incident.data.get("id")

    supabase.table("incident_states").insert({"incident_id": incident_id, "status": "OPEN"}).execute()

    return {"message": "Incident created successfully", "incident_id": incident_id}


@router.post("/{association_id}/{incident_id}/status")
def update_incident_status(
    association_id: str,
    incident_id: str,
    status: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    check_status(status)
    user_id = current_user["id"]
    verify_association_admin(association_id, user_id, supabase)
    latest_state = get_latest_state(supabase, incident_id)
    if latest_state.get("status") not in {"PENDING", "IN_PROGRESS"}:
        raise HTTPException(status_code=400, detail="Cannot update status of a resolved or discarded incident")
    elif latest_state.get("status") == status:
        raise HTTPException(status_code=400, detail=f"Incident is already in {status} status")

    supabase.table("incident_states").insert({"incident_id": incident_id, "status": status}).execute()
    return {
        "message": "Incident status updated successfully",
        "incident_id": incident_id,
        "old_status": latest_state.get("status"),
        "new_status": status,
    }
