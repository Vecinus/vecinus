from uuid import UUID

from fastapi import HTTPException
from supabase import Client


def verify_channel_access(channel_id: UUID | str, user_id: str, admin_supabase: Client):
    """Verifica que un usuario pertenece a un canal. Lanza 403 si no es así."""
    access_res = admin_supabase.table("channel_participants").select("*").eq("channel_id", str(channel_id)).eq("user_id", str(user_id)).execute()
    if not access_res.data:
        raise HTTPException(status_code=403, detail="Access denied to this channel")
    return access_res.data[0]

def verify_message_ownership(message_id: UUID | str, channel_id: UUID | str, user_id: str, admin_supabase: Client):
    """Verifica que un mensaje existe y pertenece al usuario. Lanza 404 o 403."""
    msg_res = admin_supabase.table("messages").select("*").eq("id", str(message_id)).eq("channel_id", str(channel_id)).execute()
    if not msg_res.data:
        raise HTTPException(status_code=404, detail="Message not found")
        
    original_msg = msg_res.data[0]
    if str(original_msg["sender_id"]) != str(user_id):
        raise HTTPException(status_code=403, detail="Not authorized to perform this action on this message")
        
    return original_msg

def verify_association_admin(association_id: UUID | str, user_id: str, supabase: Client):
    """Verifica que un usuario tiene rol de administrador (role=1) en la comunidad dada. Lanza 403 o 404."""
    membership_res = supabase.table("memberships").select("role").eq("association_id", str(association_id)).eq("profile_id", str(user_id)).execute()
    
    if not membership_res.data:
        raise HTTPException(status_code=404, detail="Membership not found in this community")
        
    user_role = membership_res.data[0].get("role")
    
    # 1 indica rol de administrador
    if str(user_role) != "1":
        raise HTTPException(status_code=403, detail="Admin access required for this action")
        
    return membership_res.data[0]

def verify_association_president(association_id: UUID | str, user_id: str, supabase: Client):
    """Verifica que un usuario tiene rol de presidente (role=4) en la comunidad dada. Lanza 403 o 404."""
    membership_res = supabase.table("memberships").select("role").eq("association_id", str(association_id)).eq("profile_id", str(user_id)).execute()
    
    if not membership_res.data:
        raise HTTPException(status_code=404, detail="Membership not found in this community")
        
    user_role = membership_res.data[0].get("role")
    
    # 4 indica rol de presidente
    if str(user_role) != "4":
        raise HTTPException(status_code=403, detail="Association president access required for this action")
        
    return membership_res.data[0]

def verify_property_owner(property_id: UUID | str, user_id: str, supabase: Client):
    """Verifica que un usuario es propietario de una propiedad dada. Lanza 403 o 404."""
    ownership_res = supabase.table("memberships").select("*").eq("property_id", str(property_id)).eq("profile_id", str(user_id)).execute()
    
    if not ownership_res.data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    user_role = ownership_res.data[0].get("role")

    # 2 indica rol de propietario
    if str(user_role) != "2":
        raise HTTPException(status_code=403, detail="Property owner access required for this action")
        
    return ownership_res.data[0]
