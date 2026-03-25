from uuid import UUID

from fastapi import HTTPException
from supabase import Client


def get_user_role(supabase: Client, association_id: UUID, user_id: str) -> str:
    response = (
        supabase.table("memberships")
        .select("role")
        .eq("association_id", str(association_id))
        .eq("profile_id", user_id)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=403, detail="User has no access to this association")

    return response.data[0].get("role")
