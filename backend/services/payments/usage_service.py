"""
Wrappers Python para las funciones SQL atómicas de consumo de cuotas
(`dev_s2.consume_*` / `dev_s2.revert_*`).

Las RPC viven en `backend/db/migrations/20260504_pagos_suscripciones_gocardless.sql`
y son SECURITY DEFINER con GRANT EXECUTE únicamente para `service_role`. Por
tanto siempre invocarlas con `supabase_admin` (no con el cliente del usuario).
"""

from __future__ import annotations

import logging
from typing import Any

from services.payments.subscription_service import load_subscription
from services.payments.usage_counters_service import ensure_usage_counters_initialized, usage_counters_exist
from supabase import Client

logger = logging.getLogger(__name__)


def _first_row(result: Any) -> dict[str, Any] | None:
    data = getattr(result, "data", None)
    if not data:
        return None
    if isinstance(data, list):
        return data[0] if data else None
    if isinstance(data, dict):
        return data
    return None


def _try_recover_missing_counters(supabase_admin: Client, association_id: str) -> bool:
    try:
        subscription = load_subscription(supabase_admin, association_id)
    except Exception:
        return False

    subscription_id = str(subscription.get("id") or "")
    if not subscription_id:
        return False
    if usage_counters_exist(supabase_admin, subscription_id):
        return False
    return ensure_usage_counters_initialized(supabase_admin, subscription_id)


def consume_chatbot_message(supabase_admin: Client, association_id: str) -> dict[str, Any]:
    """
    Devuelve dict con keys: allowed (bool), remaining (int), resets_at (str|None).
    Si la RPC no devuelve fila o falla, asumimos `allowed=False` para fallar
    seguro (el usuario verá HTTP 429 y reintentará).
    """
    recovered = False
    try:
        rpc_res = supabase_admin.rpc("consume_chatbot_message", {"p_association_id": association_id}).execute()
    except Exception:
        logger.exception("consume_chatbot_message RPC failed for %s", association_id)
        recovered = _try_recover_missing_counters(supabase_admin, association_id)
        if not recovered:
            return {"allowed": False, "remaining": 0, "resets_at": None}
        rpc_res = supabase_admin.rpc("consume_chatbot_message", {"p_association_id": association_id}).execute()

    row = _first_row(rpc_res) or {}
    if not row.get("allowed", False) and _try_recover_missing_counters(supabase_admin, association_id):
        rpc_res = supabase_admin.rpc("consume_chatbot_message", {"p_association_id": association_id}).execute()
        row = _first_row(rpc_res) or {}
    return {
        "allowed": bool(row.get("allowed", False)),
        "remaining": int(row.get("remaining", 0) or 0),
        "resets_at": row.get("resets_at"),
    }


def revert_chatbot_message(supabase_admin: Client, association_id: str) -> None:
    try:
        supabase_admin.rpc("revert_chatbot_message", {"p_association_id": association_id}).execute()
    except Exception:
        logger.exception("revert_chatbot_message RPC failed for %s", association_id)


def consume_minutes_seconds(
    supabase_admin: Client,
    association_id: str,
    seconds: int,
) -> dict[str, Any]:
    recovered = False
    try:
        rpc_res = supabase_admin.rpc(
            "consume_minutes_seconds",
            {"p_association_id": association_id, "p_seconds": int(seconds)},
        ).execute()
    except Exception:
        logger.exception("consume_minutes_seconds RPC failed for %s (seconds=%s)", association_id, seconds)
        recovered = _try_recover_missing_counters(supabase_admin, association_id)
        if not recovered:
            return {"allowed": False, "remaining_seconds": 0, "resets_at": None}
        rpc_res = supabase_admin.rpc(
            "consume_minutes_seconds",
            {"p_association_id": association_id, "p_seconds": int(seconds)},
        ).execute()

    row = _first_row(rpc_res) or {}
    if not row.get("allowed", False) and _try_recover_missing_counters(supabase_admin, association_id):
        rpc_res = supabase_admin.rpc(
            "consume_minutes_seconds",
            {"p_association_id": association_id, "p_seconds": int(seconds)},
        ).execute()
        row = _first_row(rpc_res) or {}
    return {
        "allowed": bool(row.get("allowed", False)),
        "remaining_seconds": int(row.get("remaining_seconds", 0) or 0),
        "resets_at": row.get("resets_at"),
    }


def revert_minutes_seconds(supabase_admin: Client, association_id: str, seconds: int) -> None:
    try:
        supabase_admin.rpc(
            "revert_minutes_seconds",
            {"p_association_id": association_id, "p_seconds": int(seconds)},
        ).execute()
    except Exception:
        logger.exception("revert_minutes_seconds RPC failed for %s (seconds=%s)", association_id, seconds)
