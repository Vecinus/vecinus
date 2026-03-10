#!/usr/bin/env python
"""AI Regression Test — evalúa la calidad del chatbot RAG con LLM-as-Judge.

Flujo:
  1. Carga el golden set (preguntas + contexto mock + respuestas esperadas).
  2. Para cada entrada, mockea Pinecone (retrieval) y usa Gemini REAL (LLM).
  3. Un segundo LLM (juez) puntúa cada respuesta generada del 1 al 5.
  4. Si la media < PASS_THRESHOLD el script sale con código 1 → CI falla.
"""

import asyncio
import json
import re
import sys
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

# ── Paths ────────────────────────────────────────────────────────────────────
BACKEND_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND_DIR))

# ── Constantes ───────────────────────────────────────────────────────────────
PASS_THRESHOLD = 4.0
JUDGE_MODEL = "gemini-2.5-pro"
COMUNIDAD_TEST = "regression_test"
GOLDEN_SET_PATH = Path(__file__).parent / "golden_set.json"
REPORT_PATH = Path(__file__).parent / "regression_report.json"
MAX_RETRIES = 4
RETRY_BASE_DELAY = 5  # segundos


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _retry_async(coro_factory, description="API call"):
    """Reintenta una corrutina con backoff exponencial ante errores transitorios."""
    for attempt in range(MAX_RETRIES):
        try:
            return await coro_factory()
        except Exception as e:
            error_str = str(e).lower()
            is_transient = any(
                kw in error_str
                for kw in ("503", "unavailable", "overloaded", "resource_exhausted", "429", "rate")
            )
            if not is_transient or attempt == MAX_RETRIES - 1:
                raise
            delay = RETRY_BASE_DELAY * (2 ** attempt)
            print(f"    [RETRY] {description} — intento {attempt + 1}/{MAX_RETRIES}, "
                  f"esperando {delay}s...")
            time.sleep(delay)
def _load_golden_set():
    with open(GOLDEN_SET_PATH, encoding="utf-8") as f:
        return json.load(f)


def _mock_pinecone_for_entry(entry):
    """Devuelve un mock de Pinecone Index que retorna el chunk del golden set."""
    idx = MagicMock()
    idx.query.return_value = {
        "matches": [
            {
                "score": 0.95,
                "metadata": {
                    "texto": entry["context"],
                    "document_title": entry["document_title"],
                },
            }
        ]
    }
    return idx


async def _judge_response(client, question, expected, actual):
    """LLM-as-Judge: puntúa la respuesta generada del 1 al 5."""
    prompt = (
        "Eres un evaluador experto de respuestas de IA sobre estatutos de "
        "comunidades de propietarios. Compara la respuesta esperada con la "
        "generada y puntúa de 1 a 5.\n\n"
        "Criterios:\n"
        "5 - Correcta, completa y coherente con la respuesta esperada.\n"
        "4 - Correcta y coherente, puede faltar algún detalle menor.\n"
        "3 - Parcialmente correcta, omite información importante.\n"
        "2 - Errores significativos o muy incompleta.\n"
        "1 - Incorrecta o sin relación con lo esperado.\n\n"
        f"PREGUNTA: {question}\n"
        f"RESPUESTA ESPERADA: {expected}\n"
        f"RESPUESTA GENERADA: {actual}\n\n"
        'Responde ÚNICAMENTE con JSON: {"score": <int 1-5>, "reason": "<breve justificación>"}'
    )

    async def _call():
        return await client.aio.models.generate_content(
            model=JUDGE_MODEL, contents=prompt
        )

    resp = await _retry_async(_call, description=f"Judge")
    text = resp.text.strip()

    match = re.search(r"\{.*?\}", text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group())
            score = int(data.get("score", 0))
            if 1 <= score <= 5:
                return data
        except (json.JSONDecodeError, ValueError):
            pass

    return {"score": 0, "reason": "No se pudo parsear la respuesta del juez."}


# ── Main ─────────────────────────────────────────────────────────────────────
async def main():
    from google import genai

    from core.config import settings
    import services.chatBot.chatBotService as svc

    api_key = settings.GEMINI_API_KEY
    if not api_key:
        print("ERROR: GEMINI_API_KEY no está configurada.")
        sys.exit(1)

    # Resetear singletons para que se use el cliente real
    svc._client = None
    svc._index = None

    golden = _load_golden_set()
    judge_client = genai.Client(api_key=api_key)

    results = []

    print("\n" + "=" * 60)
    print("  AI REGRESSION TEST")
    print("=" * 60)
    print(f"  Preguntas: {len(golden['entries'])}")
    print(f"  Threshold: {PASS_THRESHOLD}/5")
    print("=" * 60 + "\n")

    for i, entry in enumerate(golden["entries"]):
        mock_idx = _mock_pinecone_for_entry(entry)
        question = entry["question"]

        # Mock Pinecone y embeddings; Gemini LLM queda REAL
        with (
            patch.object(svc, "_get_index", return_value=mock_idx),
            patch.object(
                svc, "_get_gemini_embedding", return_value=[0.1] * 768
            ),
        ):
            async def _chatbot_call(q=question):
                return await svc.get_chatbot_response(COMUNIDAD_TEST, q)

            response = await _retry_async(
                _chatbot_call, description=f"Chatbot {entry['id']}"
            )

        actual = response["answer"]

        verdict = await _judge_response(
            judge_client,
            entry["question"],
            entry["expected_answer"],
            actual,
        )

        score = verdict.get("score", 0)
        reason = verdict.get("reason", "N/A")

        icon = "PASS" if score >= PASS_THRESHOLD else "FAIL"
        print(f"  [{icon}] {entry['id']} — Score: {score}/5")
        print(f"        Q: {entry['question']}")
        print(f"        Juez: {reason}\n")

        results.append(
            {
                "id": entry["id"],
                "question": entry["question"],
                "expected": entry["expected_answer"],
                "actual": actual,
                "score": score,
                "reason": reason,
            }
        )

        # Delay entre preguntas para evitar rate-limiting
        if i < len(golden["entries"]) - 1:
            time.sleep(2)

    avg = sum(r["score"] for r in results) / len(results)
    passed = avg >= PASS_THRESHOLD

    print("=" * 60)
    print(f"  Media:     {avg:.2f} / 5.00")
    print(f"  Threshold: {PASS_THRESHOLD}")
    print(f"  Resultado: {'PASS' if passed else 'FAIL'}")
    print("=" * 60 + "\n")

    # Escribir report para artefacto CI
    report = {
        "average_score": round(avg, 2),
        "threshold": PASS_THRESHOLD,
        "passed": passed,
        "total_questions": len(results),
        "results": results,
    }
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"  Report guardado en: {REPORT_PATH}\n")

    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    asyncio.run(main())
