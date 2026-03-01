import pytest
import time

@pytest.fixture(autouse=True)
def slow_down_tests():
    """
    Se ejecuta automáticamente después de cada test.
    Añade una pausa de 12 segundos para evitar el Rate Limit (Error 429) de Gemini.
    """
    yield
    print("\n[Pytest] Pausa de seguridad para Gemini (12s)...")
    time.sleep(12)