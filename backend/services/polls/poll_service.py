import uuid
from uuid import UUID

from fastapi import HTTPException
from schemas.polls.polls import PollCreate, PollPublish
from services.email_service import send_voting_email


class PollService:
    def __init__(self, supabase_client):
        self.supabase = supabase_client

    def create_poll(self, association_id: UUID, created_by: UUID, poll_data: PollCreate):
        data = {
            "association_id": str(association_id),
            "created_by": str(created_by),
            "title": poll_data.title,
            "description": poll_data.description,
            "options": poll_data.options,
            "status": "DRAFT",
        }

        response = self.supabase.table("poll").insert(data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Error al crear la votación")
        return response.data[0]

    def edit_poll(self, poll_id: UUID, poll_data: PollCreate):
        update_data = {
            "title": poll_data.title,
            "description": poll_data.description,
            "options": poll_data.options,
        }

        response = self.supabase.table("poll").update(update_data).eq("id", str(poll_id)).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Votación no encontrada")
        return response.data[0]

    def get_poll_by_id(self, poll_id: UUID):
        response = self.supabase.table("poll").select("*").eq("id", str(poll_id)).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Votación no encontrada")
        return response.data[0]

    def get_polls_by_community(self, association_id: UUID):
        response = (
            self.supabase.table("poll")
            .select("*")
            .eq("association_id", str(association_id))
            .order("created_at", desc=True)
            .execute()
        )
        return response.data

    def publish_poll(self, poll_id: UUID, publish_data: PollPublish):
        update_data = {
            "status": "PUBLISHED",
            "start_at": publish_data.start_at.isoformat(),
            "end_at": publish_data.end_at.isoformat(),
            "absentees_end_at": publish_data.absentees_end_at.isoformat(),
        }

        update_res = self.supabase.table("poll").update(update_data).eq("id", str(poll_id)).execute()

        if not update_res.data:
            raise HTTPException(status_code=404, detail="Votación no encontrada")

        poll_info = update_res.data[0]
        association_id = poll_info["association_id"]
        poll_title = poll_info["title"]

        assoc_res = self.supabase.table("neighborhood_associations").select("name").eq("id", association_id).execute()
        association_name = assoc_res.data[0]["name"] if assoc_res.data else "Tu Comunidad"

        voters_res = (
            self.supabase.table("memberships")
            .select("id, profiles(email, username), properties(is_defaulter)")
            .eq("association_id", association_id)
            .execute()
        )

        tokens_to_insert = []
        emails_to_send = []

        for voter in voters_res.data:

            property_data = voter.get("properties")
            if isinstance(property_data, list) and len(property_data) > 0:
                is_defaulter = property_data[0].get("is_defaulter", True)
            elif isinstance(property_data, dict):
                is_defaulter = property_data.get("is_defaulter", True)
            else:
                is_defaulter = True

            profile_data = voter.get("profiles")
            email = profile_data.get("email") if profile_data else None

            if not is_defaulter and email:
                new_token = str(uuid.uuid4())

                tokens_to_insert.append(
                    {
                        "token": new_token,
                        "poll_id": str(poll_id),
                        "membership_id": voter["id"],
                        "expires_at": publish_data.end_at.isoformat(),  # Caduca cuando se cierra la urna en la app
                    }
                )

                emails_to_send.append({"email": email, "token": new_token})

        print(
            f"[PUBLISH] Total members: {len(voters_res.data)}, Tokens created: {len(tokens_to_insert)}, Emails to send: {len(emails_to_send)}"
        )

        if tokens_to_insert:
            self.supabase.table("voting_tokens").insert(tokens_to_insert).execute()

            for data in emails_to_send:
                try:
                    send_voting_email(
                        to_email=data["email"],
                        association_name=association_name,
                        poll_title=poll_title,
                        token=data["token"],
                        poll_id=str(poll_id),
                        association_id=association_id,
                    )
                except Exception as e:
                    print(f"Error enviando correo a {data['email']}: {e}")

        return poll_info

    def close_poll_manually(self, poll_id: UUID):
        response = self.supabase.table("poll").update({"status": "MANUALLY_CLOSED"}).eq("id", str(poll_id)).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Votación no encontrada")
        return response.data[0]

    def delete_poll(self, poll_id: UUID):
        self.supabase.table("poll").delete().eq("id", str(poll_id)).execute()
        return {"message": "Votación eliminada correctamente"}
