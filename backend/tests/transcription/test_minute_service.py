from datetime import datetime
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from schemas.transcription.minutes import (
    Agreement,
    AgreementResult,
    MeetingType,
    MinutesResponse,
    Task,
)
from services.transcription.minute_service import MinuteService


@pytest.mark.anyio
async def test_create_initial_draft_does_not_store_attendees_in_content_json():
    minutes_table = MagicMock()
    minutes_table.insert.return_value.execute.return_value.data = [{"id": "minute-1"}]

    db = MagicMock()
    db.table.return_value = minutes_table

    data = MinutesResponse(
        title="Junta ordinaria marzo 2026",
        scheduled_at=datetime(2026, 3, 24, 19, 0),
        location="Residencial Vecinus",
        meeting_type=MeetingType.ORDINARY,
        transcription="Texto de prueba",
        summary="Resumen",
        topics=["Tema 1"],
        agreements=[Agreement(description="Se aprueba el presupuesto", result=AgreementResult.APPROVED)],
        tasks=[Task(responsible="Secretario", description="Enviar acta", deadline="2026-03-31")],
    )

    service = MinuteService(db)
    await service.create_initial_draft(uuid4(), data)

    inserted_payload = minutes_table.insert.call_args.args[0]
    assert "attendees" not in inserted_payload["content_json"]
    db.table.assert_called_once_with("minutes")
