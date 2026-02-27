from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from uuid import UUID
from core.deps import get_supabase, get_current_user
from core.config import settings
from schemas.alert import Alert, AlertCreate
from supabase import Client, create_client, ClientOptions

router = APIRouter(prefix="/alerts", tags=["alerts"])

@router.get("", response_model=List[Alert])
def get_alerts(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    res = supabase.table("alerts").select("*").eq("user_id", current_user["id"]).order("created_at", desc=True).execute()
    return res.data

@router.put("/{alert_id}/read", response_model=Alert)
def mark_alert_read(
    alert_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    
    # Verificamos si la alerta pertenece al usuario
    alert_res = supabase.table("alerts").select("*").eq("id", str(alert_id)).eq("user_id", current_user["id"]).execute()
    if not alert_res.data:
        raise HTTPException(status_code=404, detail="Alert not found or access denied")
    
    update_res = supabase.table("alerts").update({"is_read": True}).eq("id", str(alert_id)).execute()
    if not update_res.data:
        raise HTTPException(status_code=400, detail="Could not update alert")
        
    return update_res.data[0]
