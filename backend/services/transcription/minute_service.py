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
        return create_client(url, key, options=ClientOptions(schema=settings.SUPABASE_SCHEMA))

    async def get_minutes_by_association(self, association_id: UUID):
        res = (
            self.db.table("minutes")
            .select("*")
            .eq("association_id", str(association_id))
            .order("scheduled_at", desc=True)
            .execute()
        )
        return res.data

    async def create_initial_draft(self, association_id: UUID, data: MinutesResponse):
        content_json = {
            "summary": data.summary,
            "agreements": [a.model_dump() for a in data.agreements],
            "topics": data.topics,
            "tasks": [t.model_dump() for t in data.tasks],
            "transcription": data.transcription,
        }

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

        res = self.db.table("minutes").insert(payload).execute()

        if not res.data:
            raise RuntimeError("No se pudo insertar el borrador en la base de datos.")

        return res.data[0]
