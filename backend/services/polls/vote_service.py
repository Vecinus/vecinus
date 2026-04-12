from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from schemas.polls.votes import VoteCreate


class VoteService:
    def __init__(self, supabase_client):
        self.supabase = supabase_client

    def cast_vote(self, poll_id: UUID, vote_data: VoteCreate):
        if not vote_data.rgpd_accepted:
            raise HTTPException(status_code=400, detail="Debe aceptar la cláusula RGPD para votar")

        try:
            poll_res = self.supabase.table("poll").select("options, association_id").eq("id", str(poll_id)).execute()
            if not poll_res.data:
                raise HTTPException(status_code=404, detail="Votación no encontrada")
            
            poll_info = poll_res.data[0]
            association_id = poll_info["association_id"]
            valid_options = poll_info["options"]

            if vote_data.selected_option not in valid_options:
                raise HTTPException(status_code=400, detail=f"La opción seleccionada no es válida para esta votación. Opciones válidas: {valid_options}")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error validando votación: {str(e)}")

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

            membership_id = token_info["membership_id"]
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error validando token: {str(e)}")

        try:
            member_res = self.supabase.table("memberships").select("property_id").eq("id", membership_id).execute()
            if not member_res.data:
                raise HTTPException(status_code=404, detail="Membresía no encontrada")
            property_id = member_res.data[0]["property_id"]

            prop_res = self.supabase.table("properties").select("coefficient, is_defaulter").eq("id", property_id).execute()
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
            raise HTTPException(status_code=400, detail=f"Error verificando propiedad: {str(e)}")

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
                    status_code=400, detail="Ya has votado en esta votación. No se puede cambiar el voto una vez registrado."
                )
            raise HTTPException(
                status_code=400, detail=f"Error al registrar el voto: {str(e)}"
            )

        try:
            self.supabase.table("voting_tokens").update({"is_used": True}).eq(
                "token", str(vote_data.voting_token)
            ).execute()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error marcando token como usado: {str(e)}")

        return vote_res.data[0]
