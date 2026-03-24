import os
from uuid import UUID

from core.config import settings
from schemas.transcription.minutes import MinutesResponse
from supabase import Client, ClientOptions, create_client


class MinuteService:
    def __init__(self, db_client: Client):
        self.db = db_client

    def get_supabase_client() -> Client:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")

        # Creamos el cliente que usará el MinuteService
        return create_client(url, key, options=ClientOptions(schema=settings.SUPABASE_SCHEMA))

    async def get_minutes_by_association(self, association_id: UUID):
        """Obtiene todas las actas de una asociación."""
        res = self.db.table("minutes").select("*").eq("association_id", str(association_id)).order("scheduled_at", desc=True).execute()
        return res.data

    async def create_initial_draft(self, association_id: UUID, data: MinutesResponse):
        """Inserta el resultado de la IA en la base de datos."""
        # Separamos metadatos de contenido JSON según el esquema de la tabla
        content_json = {
            "summary": data.summary,
            "agreements": [a.model_dump() for a in data.agreements],
            "topics": data.topics,
            "tasks": [t.model_dump() for t in data.tasks],
            "attendees": [at.model_dump() for at in data.attendees],
            "transcription": data.transcription,
        }

        # Metadatos y contenidos del acta
        payload = {
            "association_id": str(association_id),
            "title": data.title or f"Acta - {data.scheduled_at.date()}",
            "location": data.location,
            "scheduled_at": data.scheduled_at.isoformat(),
            "content_json": content_json,
            "status": "DRAFT",
            "version": data.version,
            "type": data.meeting_type.value,
        }

        # Inserción en BD
        res = self.db.table("minutes").insert(payload).execute()

        if not res.data:
            raise RuntimeError("No se pudo insertar el borrador en la base de datos.")

        # --- LÓGICA DE VINCULACIÓN DE ASISTENTES ---
        inserted_row = res.data[0]
        minute_id = inserted_row["id"]

        for attendant in data.attendees:
            # Intentamos buscar al usuario por nombre en la asociación
            profile_res = self.db.table("profiles").select("id").ilike("username", f"%{attendant.name}%").execute()

            if profile_res.data and len(profile_res.data) > 0:
                profile_id = profile_res.data[0]["id"]
                try:
                    self.db.table("minutes_attendees").insert(
                        {
                            "minute_id": minute_id,
                            "profile_id": profile_id,
                            "role": attendant.role.value,
                            "is_present": attendant.is_present,
                        }
                    ).execute()
                except Exception as e:
                    print(f"No se pudo vincular al asistente {attendant.name}: {e}")

        return inserted_row
