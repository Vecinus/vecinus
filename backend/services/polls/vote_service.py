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

        token_res = (
            self.supabase.table("voting_tokens")
            .select("*")
            .eq("token", str(vote_data.voting_token))
            .eq("poll_id", str(poll_id))
            .execute()
        )
        if not token_res.data:
            raise HTTPException(status_code=404, detail="Enlace de votación inválido")

        token_info = token_res.data[0]
        if token_info["is_used"]:
            raise HTTPException(status_code=403, detail="Este enlace ya ha sido utilizado para votar")

        now = datetime.now(timezone.utc)
        if now > datetime.fromisoformat(token_info["expires_at"]):
            raise HTTPException(status_code=403, detail="El plazo para votar con este enlace ha expirado")

        poll_res = self.supabase.table("polls").select("options").eq("id", str(poll_id)).execute()
        valid_options = poll_res.data[0]["options"]
        if vote_data.selected_option not in valid_options:
            raise HTTPException(status_code=400, detail="La opción seleccionada no es válida para esta votación")

        membership_id = token_info["membership_id"]

        member_res = self.supabase.table("memberships").select("property_id").eq("id", membership_id).execute()
        property_id = member_res.data[0]["property_id"]

        prop_res = self.supabase.table("properties").select("coefficient, is_defaulter").eq("id", property_id).execute()
        property_info = prop_res.data[0]

        if property_info["is_defaulter"]:
            raise HTTPException(
                status_code=403,
                detail="No puede ejercer el derecho a voto por deudas pendientes con la comunidad (Art. 15.2 LPH)",
            )

        vote_insert_data = {
            "poll_id": str(poll_id),
            "membership_id": membership_id,
            "selected_option": vote_data.selected_option,
            "coefficient_snapshot": property_info["coefficient"],
            "rgpd_accepted_at": now.isoformat(),
        }

        try:
            vote_res = self.supabase.table("votes").insert(vote_insert_data).execute()
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"Ya se ha registrado un voto para esta propiedad, error: {str(e)}"
            )

        self.supabase.table("voting_tokens").update({"is_used": True}).eq(
            "token", str(vote_data.voting_token)
        ).execute()

        return vote_res.data[0]
