from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from typing import List, Dict
from uuid import UUID
from core.deps import get_supabase, get_current_user, get_admin_supabase
from core.config import settings
from schemas.chat import ChatChannel, Message, MessageCreate, MessageUpdate, MessageWithSender, DirectMessageCreate
from supabase import Client, create_client, ClientOptions
import json
from .chat_helpers import verify_channel_access, verify_message_ownership

router = APIRouter(prefix="/chat", tags=["chat"])

# --- REST Endpoints ---

@router.get("/channels", response_model=List[ChatChannel])
def get_user_channels(
    current_user: dict = Depends(get_current_user),
    admin_supabase: Client = Depends(get_admin_supabase)
):
    """Busca todos los canales a los que pertenece el usuario actual."""
    
    res = admin_supabase.table("channel_participants").select("channel_id").eq("user_id", current_user["id"]).execute()
    if not res.data:
        return []
        
    channel_ids = [str(item["channel_id"]) for item in res.data]
    
    channels_res = admin_supabase.table("chat_channels").select("*").in_("id", channel_ids).execute()
    return channels_res.data


@router.get("/channels/{channel_id}/messages", response_model=List[MessageWithSender])
def get_channel_messages(
    channel_id: UUID,
    current_user: dict = Depends(get_current_user),
    admin_supabase: Client = Depends(get_admin_supabase)
):
    """Busca el historial de mensajes de un canal, incluyendo la información del remitente."""
    # Verificamos si el usuario pertenece al canal
    verify_channel_access(channel_id, current_user["id"], admin_supabase)

    messages_res = admin_supabase.table("messages").select("*, sender:sender_id(id, username, avatar_url, created_at)").eq("channel_id", str(channel_id)).order("created_at", desc=False).execute()
    
    return messages_res.data


@router.post("/channels/{channel_id}/direct", response_model=ChatChannel)
def create_direct_message(
    channel_id: UUID,
    dm_in: DirectMessageCreate,
    current_user: dict = Depends(get_current_user),
    admin_supabase: Client = Depends(get_admin_supabase)
):
    """
    Crea un chat de mensaje directo con otro participante del mismo canal (comunidad).
    """
    # 1. Validar que el current_user está en el canal base para poder iniciar un DM
    verify_channel_access(channel_id, current_user["id"], admin_supabase)
        
    # 2. Obtener la comunidad a la que pertenece el canal base
    base_channel_res = admin_supabase.table("chat_channels").select("community_id").eq("id", str(channel_id)).execute()
    if not base_channel_res.data:
        raise HTTPException(status_code=404, detail="Base channel not found")
    community_id = base_channel_res.data[0]["community_id"]
    
    # 3. Validar que el target_user_id también está en la misma comunidad (comprobando su participación en canales de la comunidad, o en este canal)
    target_access_res = admin_supabase.table("channel_participants").select("*").eq("channel_id", str(channel_id)).eq("user_id", str(dm_in.target_user_id)).execute()
    if not target_access_res.data:
        raise HTTPException(status_code=400, detail="Target user is not a participant of this channel")
        
    target_user_id = str(dm_in.target_user_id)
    my_user_id = current_user["id"]
    
    # 4. Comprobar si ya existe un DM entre ellos en esta comunidad
    # Una forma de hacerlo es buscar los DMs de la comunidad y ver si ambos participan
    dm_channels_res = admin_supabase.table("chat_channels").select("id, is_blocked").eq("community_id", community_id).eq("is_direct_message", True).execute()
    if dm_channels_res.data:
        dm_channel_ids = [c["id"] for c in dm_channels_res.data]
        
        # Buscar en qué canales de DM participo yo
        my_dms_res = admin_supabase.table("channel_participants").select("channel_id").eq("user_id", my_user_id).in_("channel_id", dm_channel_ids).execute()
        my_dm_ids = [str(p["channel_id"]) for p in my_dms_res.data]
        
        if my_dm_ids:
            # Buscar en cuáles de esos participa el target
            target_dms_res = admin_supabase.table("channel_participants").select("channel_id").eq("user_id", target_user_id).in_("channel_id", my_dm_ids).execute()
            
            if target_dms_res.data:
                # Ya existe un DM entre los dos en esta comunidad
                existing_dm_id = str(target_dms_res.data[0]["channel_id"])
                
                # Obtener la info del canal para ver si está bloqueado
                existing_channel = next((c for c in dm_channels_res.data if str(c["id"]) == existing_dm_id), None)
                if existing_channel and existing_channel.get("is_blocked"):
                    raise HTTPException(status_code=403, detail="This direct message chat is blocked.")
                
                # Retornar el canal existente
                full_channel_res = admin_supabase.table("chat_channels").select("*").eq("id", existing_dm_id).execute()
                return full_channel_res.data[0]
                
    # 5. Si no existe, crearlo
    new_channel_data = {
        "community_id": community_id,
        "is_direct_message": True,
        "is_blocked": False,
        "blocked_by": None
    }
    
    new_channel_res = admin_supabase.table("chat_channels").insert(new_channel_data).execute()
    if not new_channel_res.data:
        raise HTTPException(status_code=500, detail="Failed to create direct message channel")
        
    created_channel = new_channel_res.data[0]
    
    # 6. Insertar a los dos participantes
    participants_data = [
        {"channel_id": created_channel["id"], "user_id": my_user_id},
        {"channel_id": created_channel["id"], "user_id": target_user_id}
    ]
    admin_supabase.table("channel_participants").insert(participants_data).execute()
    
    return created_channel


@router.post("/channels/{channel_id}/block")
def block_direct_message_channel(
    channel_id: UUID,
    current_user: dict = Depends(get_current_user),
    admin_supabase: Client = Depends(get_admin_supabase)
):
    """
    Bloquea permanentemente un canal de mensaje directo.
    """
    # 1. Validar que el current_user es participante del canal
    verify_channel_access(channel_id, current_user["id"], admin_supabase)
        
    # 2. Validar que el canal es un mensaje directo
    channel_res = admin_supabase.table("chat_channels").select("*").eq("id", str(channel_id)).execute()
    if not channel_res.data:
        raise HTTPException(status_code=404, detail="Channel not found")
        
    channel_data = channel_res.data[0]
    if not channel_data.get("is_direct_message"):
        raise HTTPException(status_code=400, detail="Only direct message channels can be blocked through this endpoint")
        
    # 3. Marcar como bloqueado y guardar quién lo ha bloqueado
    update_res = admin_supabase.table("chat_channels").update({
        "is_blocked": True,
        "blocked_by": current_user["id"]
    }).eq("id", str(channel_id)).execute()
    
    if not update_res.data:
        raise HTTPException(status_code=500, detail="Could not block the channel")
        
    return {"message": "Direct message channel successfully blocked."}


@router.post("/channels/{channel_id}/unblock")
def unblock_direct_message_channel(
    channel_id: UUID,
    current_user: dict = Depends(get_current_user),
    admin_supabase: Client = Depends(get_admin_supabase)
):
    """
    Desbloquea permanentemente un canal de mensaje directo, pero solo si eres la persona que lo bloqueó.
    """
    # 1. Validar que el current_user es participante del canal
    verify_channel_access(channel_id, current_user["id"], admin_supabase)
        
    # 2. Validar que el canal es un mensaje directo
    channel_res = admin_supabase.table("chat_channels").select("*").eq("id", str(channel_id)).execute()
    if not channel_res.data:
        raise HTTPException(status_code=404, detail="Channel not found")
        
    channel_data = channel_res.data[0]
    if not channel_data.get("is_direct_message"):
        raise HTTPException(status_code=400, detail="Only direct message channels can be unblocked through this endpoint")
        
    # 3. Validar que está bloqueado
    if not channel_data.get("is_blocked"):
        raise HTTPException(status_code=400, detail="This channel is not blocked")
        
    # 4. Validar que la persona que intenta desbloquear es la que lo bloqueó
    if str(channel_data.get("blocked_by")) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="You are not authorized to unblock this channel because you did not block it")

    # 5. Desbloquear
    update_res = admin_supabase.table("chat_channels").update({
        "is_blocked": False,
        "blocked_by": None
    }).eq("id", str(channel_id)).execute()
    
    if not update_res.data:
        raise HTTPException(status_code=500, detail="Could not unblock the channel")
        
    return {"message": "Direct message channel successfully unblocked."}


@router.post("/channels/{channel_id}/messages", response_model=Message)
async def send_message(
    channel_id: UUID,
    msg_in: MessageCreate,
    current_user: dict = Depends(get_current_user),
    admin_supabase: Client = Depends(get_admin_supabase)
):
    """
    Envía un nuevo mensaje a un canal a través de la API REST oficial.
    
    ¿Por qué hay un endpoint POST normal si también hay un WebSocket?
    1. Persistencia y Seguridad: Este endpoint (REST / POST) es el canal oficial para
       escribir. Comprueba tu token JWT firmemente, valida permisos seguros (RLS manual)
       y guarda el mensaje de forma persistente en Supabase.
    2. Tiempo Real: Justo después de guardar el mensaje en la base de datos, 
       esta función invoca internamente al WebSocket manager para 'retransmitir' 
       (broadcast) el mensaje en vivo a todos los usuarios conectados instantáneamente.
    """
    verify_channel_access(channel_id, current_user["id"], admin_supabase)
        
    if str(msg_in.channel_id) != str(channel_id):
        raise HTTPException(status_code=400, detail="Channel ID mismatch")

    new_msg = {
        "channel_id": str(channel_id),
        "sender_id": current_user["id"],
        "content": msg_in.content
    }
    
    insert_res = admin_supabase.table("messages").insert(new_msg).execute()
    
    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Could not send message")
        
    saved_message = insert_res.data[0]
    
    # --- Añadimos lógica de notificaciones de chat (Alertas) ---
    sender_name = current_user.get("username", "Un vecino")
    
    # Obtenemos todos los participantes del canal para notificarles, excluyendo al remitente
    all_participants_res = admin_supabase.table("channel_participants").select("user_id").eq("channel_id", str(channel_id)).execute()
    participants = [p["user_id"] for p in all_participants_res.data if p["user_id"] != current_user["id"]]
    
    if participants:
        msg_preview = msg_in.content[:100] + ("..." if len(msg_in.content) > 100 else "")
        alerts_to_insert = [
            {
                "user_id": p_id,
                "title": f"Nuevo mensaje de {sender_name}",
                "content": msg_preview,
                "is_read": False,
                "reference_id": saved_message["id"]
            }
            for p_id in participants
        ]
        admin_supabase.table("alerts").insert(alerts_to_insert).execute()
    # -----------------------------------------------------------
    
    # Retransmitimos el mensaje ya guardado a todos los clientes del WebSocket
    await manager.broadcast(saved_message, str(channel_id))
    
    return saved_message


@router.put("/channels/{channel_id}/messages/{message_id}", response_model=Message)
async def update_message(
    channel_id: UUID,
    message_id: UUID,
    msg_in: MessageUpdate,
    current_user: dict = Depends(get_current_user),
    admin_supabase: Client = Depends(get_admin_supabase)
):
    """Edita un mensaje existente y actualiza la notificación (alerta) correspondiente."""
    # 1. Verificar si el mensaje existe y pertenece al usuario
    verify_message_ownership(message_id, channel_id, current_user["id"], admin_supabase)
        
    # 2. Actualizar el mensaje
    update_res = admin_supabase.table("messages").update({
        "content": msg_in.content,
        "is_edited": True,
        "updated_at": "now()"
    }).eq("id", str(message_id)).execute()
    
    if not update_res.data:
        raise HTTPException(status_code=500, detail="Could not update message")
        
    updated_message = update_res.data[0]
    
    # 3. Actualizar la notificación (alerta) correspondiente
    sender_name = current_user.get("username", "Un vecino")
    msg_preview = msg_in.content[:100] + ("..." if len(msg_in.content) > 100 else "")
    
    admin_supabase.table("alerts").update({
        "content": msg_preview
    }).eq("reference_id", str(message_id)).execute()
    
    # 4. Retransmitir evento de edición al WebSocket
    broadcast_data = {
        "event": "message_edited",
        "message": updated_message
    }
    await manager.broadcast(broadcast_data, str(channel_id))
    
    return updated_message


@router.delete("/channels/{channel_id}/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    channel_id: UUID,
    message_id: UUID,
    current_user: dict = Depends(get_current_user),
    admin_supabase: Client = Depends(get_admin_supabase)
):
    """Elimina un mensaje y sus notificaciones correspondientes."""
    # 1. Verificar si el mensaje existe y pertenece al usuario
    verify_message_ownership(message_id, channel_id, current_user["id"], admin_supabase)
        
    # 2. Eliminar el mensaje
    delete_res = admin_supabase.table("messages").delete().eq("id", str(message_id)).execute()
    # Supabase Python client .delete() might return data if it has returning=* or we can just rely on not raising
    
    # 3. Eliminar la alerta correspondiente (si reference_id = message_id)
    admin_supabase.table("alerts").delete().eq("reference_id", str(message_id)).execute()
    
    # 4. Retransmitir evento de borrado al WebSocket
    broadcast_data = {
        "event": "message_deleted",
        "message_id": str(message_id),
        "channel_id": str(channel_id)
    }
    await manager.broadcast(broadcast_data, str(channel_id))
    
    return None

# --- WebSocket Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, channel_id: str):
        await websocket.accept()
        if channel_id not in self.active_connections:
            self.active_connections[channel_id] = []
        self.active_connections[channel_id].append(websocket)

    def disconnect(self, websocket: WebSocket, channel_id: str):
        if channel_id in self.active_connections:
            if websocket in self.active_connections[channel_id]:
                self.active_connections[channel_id].remove(websocket)
            if not self.active_connections[channel_id]:
                del self.active_connections[channel_id]

    async def broadcast(self, message: dict, channel_id: str):
        if channel_id in self.active_connections:
            for connection in self.active_connections[channel_id]:
                # Send JSON stringified data to frontend
                await connection.send_text(json.dumps(message))

manager = ConnectionManager()

@router.websocket("/ws/{channel_id}")
async def websocket_endpoint(websocket: WebSocket, channel_id: str):
    """
    Túnel WebSocket para recibir notificaciones en Tiempo Real (Live Feed).
    
    Este endpoint está pensado idealmente para SERVIDOR -> CLIENTE. 
    Es decir, los clientes se conectan aquí y simplemente "escuchan" a que el 
    gestor de conexiones (ConnectionManager) les escupa los mensajes nuevos
    que se han guardado desde la API POST.
    """
    await manager.connect(websocket, channel_id)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast({"channel_id": channel_id, "data": data, "type": "echo_test"}, channel_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel_id)
