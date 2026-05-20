import pytest
from services.chatBot.documents_ChatBotService import MAX_RAW_TEXT_CHARS, index_document


def test_index_document_rejects_oversized_text_before_external_calls():
    oversized_text = "x" * (MAX_RAW_TEXT_CHARS + 1)

    with pytest.raises(ValueError):
        index_document("community-id", "normas", oversized_text)


def test_index_document_returns_zero_for_blank_text():
    assert index_document("community-id", "normas", "   ") == 0
