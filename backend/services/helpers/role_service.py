from uuid import UUID

from fastapi import HTTPException, status
from supabase import Client


def get_user_role(supabase: Client, association_id: UUID, user_id: str) -> str:
    response = (
        supabase.table("memberships")
        .select("role")
        .eq("association_id", str(association_id))
        .eq("profile_id", str(user_id))
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=403, detail="User has no access to this association")

    return response.data[0].get("role")


class RoleService:
    @staticmethod
    def verify_admin_or_president_permissions(supabase_client, user_id: UUID, association_id: UUID):
        """
        Verifica que el usuario sea Administrador o Presidente de la comunidad.
        Si no lo es, lanza un Error 403 (Forbidden) automáticamente.
        """
        member_check = (
            supabase_client.table("memberships")
            .select("id")
            .eq("profile_id", str(user_id))
            .eq("association_id", str(association_id))
            .execute()
        )

        if not member_check.data:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No perteneces a esta comunidad.")

        # role: 1=ADMIN, 2=OWNER, 3=TENANT, 4=PRESIDENT, 5=EMPLOYEE
        perm_check = (
            supabase_client.table("memberships")
            .select("id")
            .eq("profile_id", str(user_id))
            .eq("association_id", str(association_id))
            .in_("role", [1, 4])
            .execute()
        )

        if not perm_check.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes los permisos necesarios. Solo los administradores pueden gestionar votaciones.",
            )

        return True
