from __future__ import annotations

import logging
from datetime import datetime, timezone

from services.payments.subscription_service import load_association_household_count, load_plan_by_id
from supabase import Client

logger = logging.getLogger(__name__)


def reset_usage_counters(supabase_admin: Client, subscription_id: str) -> None:
    try:
        supabase_admin.rpc("reset_usage_counters", {"p_subscription_id": subscription_id}).execute()
    except Exception:
        logger.exception("reset_usage_counters RPC failed for subscription %s", subscription_id)


def usage_counters_exist(supabase_admin: Client, subscription_id: str) -> bool:
    res = (
        supabase_admin.table("community_usage_counters")
        .select("community_subscription_id")
        .eq("community_subscription_id", subscription_id)
        .limit(1)
        .execute()
    )
    return bool(res.data)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _build_period_bounds(now: datetime) -> tuple[str, str]:
    period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if period_start.month == 12:
        next_month = period_start.replace(year=period_start.year + 1, month=1)
    else:
        next_month = period_start.replace(month=period_start.month + 1)
    return period_start.isoformat(), next_month.isoformat()


def bootstrap_usage_counters(supabase_admin: Client, subscription_id: str) -> bool:
    try:
        subscription_res = (
            supabase_admin.table("community_subscriptions").select("*").eq("id", subscription_id).limit(1).execute()
        )
        if not subscription_res.data:
            return False
        subscription = subscription_res.data[0]

        plan_id = subscription.get("subscription_plan_id")
        association_id = str(subscription.get("association_id") or "")
        if not plan_id or not association_id:
            return False

        plan = load_plan_by_id(supabase_admin, str(plan_id))
        if not plan:
            return False

        household_count = load_association_household_count(supabase_admin, association_id)
        chatbot_quota = int(plan.get("chatbot_base_msg") or 0) + int(plan.get("chatbot_per_household_msg") or 0) * max(
            household_count, 0
        )
        minutes_per_month = int(plan.get("minutes_seconds_per_month") or 0)
        minutes_cap = int(plan.get("minutes_seconds_cap") or 0)
        period_started_at, period_ends_at = _build_period_bounds(_now())

        insert_payload = {
            "community_subscription_id": subscription_id,
            "chatbot_messages_quota": chatbot_quota,
            "chatbot_messages_used": 0,
            "minutes_seconds_balance": minutes_per_month,
            "minutes_seconds_used": 0,
            "minutes_seconds_cap": minutes_cap,
            "period_started_at": period_started_at,
            "period_ends_at": period_ends_at,
            "last_reset_at": period_started_at,
        }
        supabase_admin.table("community_usage_counters").insert(insert_payload).execute()
        supabase_admin.table("community_subscriptions").update(
            {
                "current_period_start": period_started_at,
                "current_period_end": period_ends_at,
            }
        ).eq("id", subscription_id).execute()
        return usage_counters_exist(supabase_admin, subscription_id)
    except Exception:
        logger.exception("Manual usage counter bootstrap failed for subscription %s", subscription_id)
        return False


def ensure_usage_counters_initialized(supabase_admin: Client, subscription_id: str) -> bool:
    reset_usage_counters(supabase_admin, subscription_id)
    if usage_counters_exist(supabase_admin, subscription_id):
        return True

    logger.warning(
        "Usage counters missing after reset for subscription %s; retrying once",
        subscription_id,
    )
    reset_usage_counters(supabase_admin, subscription_id)
    if usage_counters_exist(supabase_admin, subscription_id):
        return True

    logger.warning(
        "Usage counters still missing after RPC retries for subscription %s; attempting manual bootstrap",
        subscription_id,
    )
    if bootstrap_usage_counters(supabase_admin, subscription_id):
        return True

    logger.error(
        "Usage counters still missing after retry for subscription %s",
        subscription_id,
    )
    return False
