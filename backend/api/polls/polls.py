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

    RoleService.verify_admin_or_president_permissions(supabase, user_id, association_id)

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

    RoleService.verify_admin_or_president_permissions(supabase, user_id, association_id)

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

    RoleService.verify_admin_or_president_permissions(supabase, user_id, association_id)

    service = PollService(supabase)
    return service.close_poll_manually(poll_id)


@router.post("/{poll_id}/vote", response_model=VoteResponse, status_code=status.HTTP_201_CREATED)
def cast_vote(
    poll_id: UUID,
    vote_data: VoteCreate,
    supabase: Client = Depends(get_supabase),
    current_user: dict = Depends(get_current_user),
):
    """Registra el voto de un vecino usando su token de votación obtenido por autenticación de email."""
    service = VoteService(supabase)
    return service.cast_vote(poll_id, vote_data)


@router.get("/{association_id}/{poll_id}/results", response_model=PollResultResponse)
def get_poll_results(association_id: UUID, poll_id: UUID, supabase: Client = Depends(get_supabase_admin)):
    """Genera el escrutinio de la votación (Doble mayoría: Personas y Cuotas)."""
    service = EscrutinioService(supabase)
    return service.calculate_results(poll_id, association_id)


@router.get("/{poll_id}", response_model=PollResponse)
def get_poll_by_id(poll_id: UUID, supabase: Client = Depends(get_supabase)):
    """Obtiene los detalles de una votación por su ID."""
    service = PollService(supabase)
    return service.get_poll_by_id(poll_id)


@router.get("/{poll_id}/membership-info")
def get_poll_membership_info(
    poll_id: UUID, current_user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)
):
    """Obtiene el coeficiente y el estado de morosidad del vecino para una votación."""
    # 1. Obtener la asociación de esta votación
    poll_res = supabase.table("poll").select("association_id").eq("id", str(poll_id)).execute()
    if not poll_res.data:
        raise HTTPException(status_code=404, detail="Votación no encontrada")

    association_id = poll_res.data[0]["association_id"]

    # 2. Buscar la membresía del usuario actual
    member_res = (
        supabase.table("memberships")
        .select("role, property_id, properties(coefficient, is_defaulter)")
        .eq("profile_id", current_user["id"])
        .eq("association_id", association_id)
        .execute()
    )

    if not member_res.data:
        raise HTTPException(status_code=404, detail="No eres miembro de esta comunidad")

    membership = member_res.data[0]
    prop = membership.get("properties")

    is_defaulter = False
    coefficient = 0.0

    # Extraer los datos dependiendo de cómo Supabase devuelva la relación
    if prop:
        if isinstance(prop, list) and len(prop) > 0:
            is_defaulter = prop[0].get("is_defaulter", False)
            coefficient = prop[0].get("coefficient", 0.0)
        elif isinstance(prop, dict):
            is_defaulter = prop.get("is_defaulter", False)
            coefficient = prop.get("coefficient", 0.0)

    if is_defaulter:
        raise HTTPException(status_code=403, detail="El usuario es moroso")

    return {"coefficient": coefficient, "is_defaulter": is_defaulter}


@router.get("/{poll_id}/has-voted")
def has_user_voted(
    poll_id: UUID, current_user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)
):
    """Verifica si el usuario ya ha votado en esta votación."""
    poll_res = supabase.table("poll").select("association_id").eq("id", str(poll_id)).execute()
    if not poll_res.data:
        raise HTTPException(status_code=404, detail="Votación no encontrada")

    association_id = poll_res.data[0]["association_id"]

    member_res = (
        supabase.table("memberships")
        .select("id")
        .eq("profile_id", current_user["id"])
        .eq("association_id", association_id)
        .execute()
    )

    if not member_res.data:
        raise HTTPException(status_code=403, detail="No eres miembro de esta comunidad")

    membership_id = member_res.data[0]["id"]

    vote_res = (
        supabase.table("vote").select("id").eq("poll_id", str(poll_id)).eq("membership_id", membership_id).execute()
    )

    return {"has_voted": len(vote_res.data) > 0}


@router.post("/{poll_id}/request-auth-token")
def request_voting_auth_token(
    poll_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Genera un token de autenticación para votación y lo envía al email del usuario logeado."""
    import uuid

    user_id = current_user["id"]
    user_email = current_user.get("email")

    if not user_email:
        raise HTTPException(status_code=400, detail="El usuario no tiene email registrado")

    poll_res = supabase.table("poll").select("association_id, title").eq("id", str(poll_id)).execute()
    if not poll_res.data:
        raise HTTPException(status_code=404, detail="Votación no encontrada")

    poll_info = poll_res.data[0]
    association_id = poll_info["association_id"]
    poll_title = poll_info["title"]

    member_res = (
        supabase.table("memberships")
        .select("id")
        .eq("profile_id", user_id)
        .eq("association_id", association_id)
        .execute()
    )

    if not member_res.data:
        raise HTTPException(status_code=403, detail="No eres miembro de esta comunidad")

    membership_id = member_res.data[0]["id"]

    vote_res = (
        supabase.table("vote").select("id").eq("poll_id", str(poll_id)).eq("membership_id", membership_id).execute()
    )

    if len(vote_res.data) > 0:
        raise HTTPException(status_code=400, detail="Ya has votado en esta votación")

    auth_token = str(uuid.uuid4())

    token_data = {
        "token": auth_token,
        "poll_id": str(poll_id),
        "user_id": user_id,
        "membership_id": membership_id,
        "email": user_email,
        "is_used": False,
    }

    try:
        supabase.table("voting_auth_tokens").insert(token_data).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al crear el token: {str(e)}")

    assoc_res = supabase.table("neighborhood_associations").select("name").eq("id", association_id).execute()
    association_name = assoc_res.data[0]["name"] if assoc_res.data else "Tu Comunidad"

    try:
        from services.email_service import send_voting_auth_email

        send_voting_auth_email(
            to_email=user_email,
            association_name=association_name,
            poll_title=poll_title,
            auth_token=auth_token,
        )
    except Exception as e:
        print(f"Error enviando correo de autenticación a {user_email}: {e}")
        raise HTTPException(status_code=500, detail="Error al enviar el correo de autenticación")

    return {"message": f"Se ha enviado un código de autenticación a {user_email}", "email": user_email}


@router.patch("/{poll_id}", response_model=PollResponse)
def edit_poll(
    poll_id: UUID,
    poll_data: PollCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_admin),
):
    """Edita una votación en estado DRAFT (Solo Admins)."""
    user_id = current_user["id"]

    poll_res = supabase.table("poll").select("association_id, status").eq("id", str(poll_id)).execute()
    if not poll_res.data:
        raise HTTPException(status_code=404, detail="Votación no encontrada")

    poll = poll_res.data[0]
    association_id = poll["association_id"]

    if poll["status"] != "DRAFT":
        raise HTTPException(status_code=400, detail="Solo puedes editar votaciones en estado DRAFT")

    RoleService.verify_admin_or_president_permissions(supabase, user_id, association_id)

    service = PollService(supabase)
    return service.edit_poll(poll_id, poll_data)


@router.delete("/{poll_id}")
def delete_poll(
    poll_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_admin),
):
    """Elimina una votación en estado DRAFT (Solo Admins)."""
    user_id = current_user["id"]

    poll_res = supabase.table("poll").select("association_id, status").eq("id", str(poll_id)).execute()
    if not poll_res.data:
        raise HTTPException(status_code=404, detail="Votación no encontrada")

    poll = poll_res.data[0]
    association_id = poll["association_id"]

    if poll["status"] != "DRAFT":
        raise HTTPException(status_code=400, detail="Solo puedes eliminar votaciones en estado DRAFT")

    RoleService.verify_admin_or_president_permissions(supabase, user_id, association_id)

    service = PollService(supabase)
    return service.delete_poll(poll_id)
