import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from schemas.polls.votes import VoteCreate

logger = logging.getLogger(__name__)


class VoteService:
    def __init__(self, supabase_client):
        self.supabase = supabase_client

    @staticmethod
    def _parse_datetime(value):
        if not value:
            return None
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed

    @classmethod
    def _ensure_poll_is_open(cls, poll_info):
        if poll_info.get("status") != "PUBLISHED":
            raise HTTPException(status_code=403, detail="Esta votacion no esta abierta")

        start_at = cls._parse_datetime(poll_info.get("start_at"))
        end_at = cls._parse_datetime(poll_info.get("end_at"))
        if not start_at or not end_at:
            raise HTTPException(status_code=403, detail="Esta votacion no tiene una ventana valida de voto")

        now = datetime.now(timezone.utc)
        if now < start_at:
            raise HTTPException(status_code=403, detail="Esta votacion aun no ha comenzado")
        if now > end_at:
            raise HTTPException(status_code=403, detail="Esta votacion ya ha finalizado")

    def cast_vote(self, poll_id: UUID, vote_data: VoteCreate):
        if not vote_data.rgpd_accepted:
            raise HTTPException(status_code=400, detail="Debe aceptar la cláusula RGPD para votar")

        try:
            poll_res = (
                self.supabase.table("poll")
                .select("options, association_id, status, start_at, end_at")
                .eq("id", str(poll_id))
                .execute()
            )
            if not poll_res.data:
                raise HTTPException(status_code=404, detail="Votación no encontrada")

            poll_info = poll_res.data[0]
            poll_info["association_id"]
            self._ensure_poll_is_open(poll_info)
            valid_options = poll_info["options"]

            if vote_data.selected_option not in valid_options:
                raise HTTPException(
                    status_code=400,
                    detail=f"La opción seleccionada no es válida para esta votación. Opciones válidas: {valid_options}",
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error validando votación: %s", e)
            raise HTTPException(status_code=400, detail="Error validando votación")

        try:
            token_res = (
                self.supabase.table("voting_tokens")
                .select("*")
                .eq("token", str(vote_data.voting_token))
                .eq("poll_id", str(poll_id))
                .execute()
            )
            if not token_res.data:
                raise HTTPException(status_code=404, detail="Token de votación inválido")

            token_info = token_res.data[0]
            if token_info["is_used"]:
                raise HTTPException(status_code=403, detail="Este token ya ha sido utilizado para votar")

            expires_at_str = token_info.get("expires_at")
            if expires_at_str:
                expires_at = self._parse_datetime(expires_at_str)
                if expires_at < datetime.now(timezone.utc):
                    raise HTTPException(status_code=403, detail="El token de votación ha expirado")

            membership_id = token_info["membership_id"]
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error validando el token de votación: %s", e)
            raise HTTPException(status_code=400, detail="Error validando token")

        try:
            member_res = self.supabase.table("memberships").select("property_id").eq("id", membership_id).execute()
            if not member_res.data:
                raise HTTPException(status_code=404, detail="Membresía no encontrada")
            property_id = member_res.data[0]["property_id"]

            prop_res = (
                self.supabase.table("properties").select("coefficient, is_defaulter").eq("id", property_id).execute()
            )
            if not prop_res.data:
                raise HTTPException(status_code=404, detail="Propiedad no encontrada")

            property_info = prop_res.data[0]

            if property_info["is_defaulter"]:
                raise HTTPException(
                    status_code=403,
                    detail="No puede ejercer el derecho a voto por deudas pendientes con la comunidad (Art. 15.2 LPH)",
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error verificando propiedad: %s", e)
            raise HTTPException(status_code=400, detail="Error verificando propiedad")

        now = datetime.now(timezone.utc)
        vote_insert_data = {
            "poll_id": str(poll_id),
            "membership_id": membership_id,
            "selected_option": vote_data.selected_option,
            "coefficient_snapshot": property_info["coefficient"],
            "rgpd_accepted_at": now.isoformat(),
        }

        try:
            vote_res = self.supabase.table("vote").insert(vote_insert_data).execute()
        except Exception as e:
            error_str = str(e).lower()
            if "unique" in error_str or "already" in error_str or "duplicate" in error_str:
                raise HTTPException(
                    status_code=400,
                    detail="Ya has votado en esta votación. No se puede cambiar el voto una vez registrado.",
                )
            logger.error("Error al registrar el voto: %s", e)
            raise HTTPException(status_code=400, detail="Error al registrar el voto")

        try:
            self.supabase.table("voting_tokens").update({"is_used": True}).eq(
                "token", str(vote_data.voting_token)
            ).execute()
        except Exception as e:
            logger.error("Error marcando el token de votación como usado: %s", e)
            raise HTTPException(status_code=400, detail="Error marcando token como usado")

        return vote_res.data[0]
