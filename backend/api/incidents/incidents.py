import cloudinary
import cloudinary.uploader
from api.chat.chat_helpers import verify_association_membership
from core.config import settings
from core.deps import get_current_user, get_supabase
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from schemas.incidents.incidents import Incident
from services.helpers.role_service import get_user_role
from supabase import Client

router = APIRouter(prefix="/incidents", tags=["incidents"])
cloudinary.config(cloudinary_url=settings.CLOUDINARY_URL, secure=True)

ALLOWED_STATUSES = {"PENDING", "IN PROGRESS", "SOLVED", "DISCARDED"}
ALLOWED_TYPES = {"LIGHTING", "ELECTRICITY", "ELEVATOR", "PLUMBING", "SAFETY", "WORKERS", "POOL", "OTHER"}


def check_status(status: str):
    if status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed values: {ALLOWED_STATUSES}")


def check_type(type: str):
    if type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid incident type. Allowed values: {ALLOWED_TYPES}")


def get_latest_state(supabase: Client, incident_id: str) -> dict[str, dict]:
    if not incident_id or incident_id == "":
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


def verify_own_incident(association_id: str, incident_id: str, user_id: str, supabase: Client):
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

    incident_res = (
        supabase.table("incidents").select("id").eq("id", incident_id).eq("membership_id", membership_id).execute()
    )

    if not incident_res.data:
        return False
    elif incident_res.data > 1:
        raise HTTPException(status_code=500, detail="Multiple incidents found with the same ID and membership")
    return True


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
    is_admin = (
        supabase.table("memberships")
        .select("role")
        .eq("association_id", str(association_id))
        .eq("profile_id", str(user_id))
        .execute()
    ).data[0].get("role") == "1"
    if status == "DISCARDED" and not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required for this action")

    incidents_res = supabase.table("incidents").select("""
                id,
                type,
                description,
                created_at,
                image_url,
                membership_id,
                memberships(association_id, role)
                """).eq("memberships.association_id", association_id).execute()

    raw_incidents = incidents_res.data or []
    incidents = []
    for incident in raw_incidents:
        if incident:
            latest_state = get_latest_state(supabase, incident["id"])
            incident_status = latest_state.get("status")
            if incident_status == "DISCARDED" and not is_admin and not mine:
                continue
            incident["status"] = incident_status
            incidents.append(incident)

    if status:
        check_status(status)
        incidents = [incident for incident in incidents if incident.get("status") == status]

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
                """).eq("id", incident_id).order("created_at", desc=True, foreign_table="incident_states").execute()
    if not incident_res.data:
        raise HTTPException(status_code=404, detail="Incident not found")

    return incident_res.data[0]


@router.post("/{association_id}", status_code=201)
def create_incident(
    association_id: str,
    incident_type: str = Form(..., alias="type"),
    description: str | None = Form(None),
    file: UploadFile | None = File(None),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    check_type(incident_type)
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
    elif membership_res.data[0].get("role") == "1":
        raise HTTPException(status_code=403, detail="Admins cannot create incidents")

    membership_id = membership_res.data[0].get("id")

    image_url = None
    if file:
        try:
            if not settings.CLOUDINARY_URL:
                raise HTTPException(status_code=500, detail="Cloudinary configuration is missing")
            else:
                upload = cloudinary.uploader.upload(file.file, folder=f"incidents/{association_id}")
                image_url = upload.get("secure_url")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

    new_incident = (
        supabase.table("incidents")
        .insert(
            {
                "type": incident_type,
                "description": description,
                "image_url": image_url,
                "membership_id": membership_id,
            }
        )
        .execute()
    )

    if not new_incident.data:
        raise HTTPException(status_code=500, detail="Failed to create incident in database")

    incident_id = new_incident.data[0].get("id")

    incident_state = (
        supabase.table("incident_states").insert({"incident_id": incident_id, "status": "PENDING"}).execute()
    )

    incident_state_id = incident_state.data[0].get("id")

    return {
        "message": "Incident created successfully",
        "incident_id": incident_id,
        "incident_state_id": incident_state_id,
        "image_url": image_url,
    }


@router.post("/{association_id}/{incident_id}/status", status_code=201)
def update_incident_status(
    association_id: str,
    incident_id: str,
    status: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    check_status(status)
    user_id = current_user["id"]
    if get_user_role(supabase, association_id, user_id) not in {"1", "4", "5"}:
        raise HTTPException(status_code=403, detail="Admin, president or employee access required for this action")
    elif verify_own_incident(association_id, incident_id, user_id, supabase):
        raise HTTPException(status_code=403, detail="Users cannot update the status of their own incidents")

    latest_state = get_latest_state(supabase, incident_id)

    if not latest_state:
        raise HTTPException(status_code=404, detail="Incident not found")
    elif latest_state.get("status") not in {"PENDING", "IN PROGRESS"}:
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


@router.delete("/{association_id}/{incident_id}", status_code=204)
def discard_incident(
    association_id: str,
    incident_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    user_id = current_user["id"]
    if not verify_own_incident(association_id, incident_id, user_id, supabase):
        raise HTTPException(status_code=403, detail="User does not own this incident")

    latest_state = get_latest_state(supabase, incident_id)

    if not latest_state:
        raise HTTPException(status_code=404, detail="Incident not found")
    elif latest_state.get("status") not in {"DISCARDED", "SOLVED"}:
        raise HTTPException(status_code=400, detail="Incident hasn't been reviewed")

    try:
        supabase.table("incident_states").delete().eq("incident_id", incident_id).execute()
        supabase.table("incidents").delete().eq("id", incident_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to discard incident: {str(e)}")
