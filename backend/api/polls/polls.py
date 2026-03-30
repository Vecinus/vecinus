from typing import List
from uuid import UUID

from core.deps import get_current_user, get_supabase, get_supabase_admin
from fastapi import APIRouter, Depends, HTTPException, status
from schemas.polls.polls import PollCreate, PollPublish, PollResponse
from schemas.polls.results import PollResultResponse
from schemas.polls.votes import VoteCreate, VoteResponse
from services.helpers.role_service import RoleService
from services.polls.escrutinio_service import EscrutinioService
from services.polls.poll_service import PollService
from services.polls.vote_service import VoteService
from supabase import Client

router = APIRouter(prefix="/polls", tags=["Votaciones"])


@router.post("/associations/{association_id}", response_model=PollResponse, status_code=status.HTTP_201_CREATED)
def create_poll(
    association_id: UUID,
    poll_data: PollCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Crea una nueva votación en estado DRAFT (Solo Admins)."""
    user_id = current_user["id"]

    RoleService.verify_admin_permissions(supabase, user_id, association_id)

    service = PollService(supabase)
    return service.create_poll(association_id, user_id, poll_data)


@router.get("/associations/{association_id}", response_model=List[PollResponse])
def get_polls(association_id: UUID, supabase: Client = Depends(get_supabase)):
    """Lista todas las votaciones de una comunidad. El estado (ACTIVE, PENDING...) se calcula automáticamente."""
    service = PollService(supabase)
    return service.get_polls_by_community(association_id)


@router.put("/{poll_id}/publish", response_model=PollResponse)
def publish_poll(
    poll_id: UUID,
    publish_data: PollPublish,
    current_user: dict = Depends(get_current_user),  # Añadimos el usuario logueado
    supabase: Client = Depends(get_supabase_admin),
):
    """Publica una votación y envía los links mágicos (Solo Admins)."""
    user_id = current_user["id"]

    poll_res = supabase.table("poll").select("association_id").eq("id", str(poll_id)).execute()
    if not poll_res.data:
        raise HTTPException(status_code=404, detail="Votación no encontrada")

    association_id = poll_res.data[0]["association_id"]

    RoleService.verify_admin_permissions(supabase, user_id, association_id)

    service = PollService(supabase)
    return service.publish_poll(poll_id, publish_data)


@router.post("/{poll_id}/close", response_model=PollResponse)
def close_poll_manually(
    poll_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_admin),
):
    """Fuerza el cierre de una votación (Solo Admins)."""
    user_id = current_user["id"]

    poll_res = supabase.table("poll").select("association_id").eq("id", str(poll_id)).execute()
    if not poll_res.data:
        raise HTTPException(status_code=404, detail="Votación no encontrada")

    association_id = poll_res.data[0]["association_id"]

    RoleService.verify_admin_permissions(supabase, user_id, association_id)

    service = PollService(supabase)
    return service.close_poll_manually(poll_id)


@router.post("/{poll_id}/vote", response_model=VoteResponse, status_code=status.HTTP_201_CREATED)
def cast_vote(poll_id: UUID, vote_data: VoteCreate, supabase: Client = Depends(get_supabase)):
    """Registra el voto de un vecino validando su Token y calculando su cuota (LPH)."""
    service = VoteService(supabase)
    return service.cast_vote(poll_id, vote_data)


@router.get("/{association_id}/{poll_id}/results", response_model=PollResultResponse)
def get_poll_results(association_id: UUID, poll_id: UUID, supabase: Client = Depends(get_supabase_admin)):
    """Genera el escrutinio de la votación (Doble mayoría: Personas y Cuotas)."""
    service = EscrutinioService(supabase)
    return service.calculate_results(poll_id, association_id)
