from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from supabase import Client


def load_subscription(supabase_admin: Client, association_id: str) -> dict[str, Any]:
    res = (
        supabase_admin.table("community_subscriptions")
        .select("*")
        .eq("association_id", association_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe suscripción para esta comunidad",
        )
    return res.data[0]


def load_plan_by_id(supabase_admin: Client, plan_id: str) -> dict[str, Any] | None:
    res = (
        supabase_admin.table("subscription_plans")
        .select(
            "id, code, display_name, base_cents, per_household_cents, "
            "minutes_seconds_per_month, minutes_seconds_cap, "
            "chatbot_base_msg, chatbot_per_household_msg, "
            "chatbot_input_chars, chatbot_output_chars"
        )
        .eq("id", plan_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def load_plan_by_code(supabase_admin: Client, code: str) -> dict[str, Any]:
    res = (
        supabase_admin.table("subscription_plans")
        .select(
            "id, code, display_name, base_cents, per_household_cents, "
            "minutes_seconds_per_month, minutes_seconds_cap, "
            "chatbot_base_msg, chatbot_per_household_msg, "
            "chatbot_input_chars, chatbot_output_chars"
        )
        .eq("code", code)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe un plan activo con código '{code}'",
        )
    return res.data[0]


def load_association_household_count(supabase_admin: Client, association_id: str) -> int:
    res = (
        supabase_admin.table("neighborhood_associations")
        .select("household_count")
        .eq("id", association_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        return 0
    try:
        return int(res.data[0].get("household_count") or 0)
    except (TypeError, ValueError):
        return 0


def count_association_properties(supabase_admin: Client, association_id: str) -> int:
    res = supabase_admin.table("properties").select("id").eq("association_id", association_id).execute()
    return len(res.data or [])


def calculate_amount_cents(plan: dict[str, Any], household_count: int) -> int:
    return int(plan["base_cents"]) + int(plan["per_household_cents"]) * int(household_count)


def resolve_operational_household_limit(subscription: dict[str, Any], active_household_count: int) -> int:
    pending_household_count = subscription.get("pending_household_count")
    try:
        pending_limit = int(pending_household_count) if pending_household_count is not None else None
    except (TypeError, ValueError):
        pending_limit = None

    active_limit = max(int(active_household_count or 0), 0)
    if pending_limit is None:
        return active_limit
    return min(active_limit, max(pending_limit, 0))
