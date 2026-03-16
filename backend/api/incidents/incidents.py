from api.chat.chat_helpers import verify_association_membership
from core.deps import get_current_user, get_supabase
from fastapi import APIRouter, Depends, HTTPException
from schemas.incidents.incidents import Incident
from supabase import Client

router = APIRouter(prefix="/incidents", tags=["incidents"])

ALLOWED_STATUSES = {"OPEN", "IN_PROGRESS", "RESOLVED", "DISCARDED"}
ALLOWED_TYPES = {"LIGHTING", "ELECTRICITY", "ELEVATOR", "PLUMBING", "SAFETY", "WORKERS", "POOL", "OTHER"}


def check_status(status: str):
    if status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed values: {ALLOWED_STATUSES}")


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

    incidents_res = supabase.table("incidents").select("""
                id,
                type,
                description,
                created_at,
                image,
                membership_id,
                memberships(association_id)
                """).eq("memberships.association_id", association_id).execute()
    incidents = incidents_res.data or []
    for incident in incidents:
        latest_state = get_latest_state(supabase, incident["id"])
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
