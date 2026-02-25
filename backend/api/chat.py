from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from typing import List, Dict
from uuid import UUID
from core.deps import get_supabase, get_current_user
from core.config import settings
from schemas.chat import ChatChannel, Message, MessageCreate, MessageUpdate, MessageWithSender
from supabase import Client, create_client, ClientOptions
import json

router = APIRouter(prefix="/chat", tags=["chat"])

# --- REST Endpoints ---

@router.get("/channels", response_model=List[ChatChannel])
def get_user_channels(
    current_user: dict = Depends(get_current_user)
):
    """Fetch all channels the current user is a part of."""
    admin_supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY, options=ClientOptions(schema="dev"))
    
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
    supabase: Client = Depends(get_supabase)
):
    """Fetch message history for a channel, including sender profile info."""
    # We use admin client to bypass RLS, we already verified the user via JWT
    admin_supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY, options=ClientOptions(schema="dev"))
    
    access_res = admin_supabase.table("channel_participants").select("*").eq("channel_id", str(channel_id)).eq("user_id", current_user["id"]).execute()
    if not access_res.data:
        raise HTTPException(status_code=403, detail="Access denied to this channel")

    messages_res = admin_supabase.table("messages").select("*, sender:sender_id(id, username, avatar_url, created_at)").eq("channel_id", str(channel_id)).order("created_at", desc=False).execute()
    
    return messages_res.data


@router.post("/channels/{channel_id}/messages", response_model=Message)
async def send_message(
    channel_id: UUID,
    msg_in: MessageCreate,
    current_user: dict = Depends(get_current_user)
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
    admin_supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY, options=ClientOptions(schema="dev"))
    
    access_res = admin_supabase.table("channel_participants").select("*").eq("channel_id", str(channel_id)).eq("user_id", current_user["id"]).execute()
    if not access_res.data:
        raise HTTPException(status_code=403, detail="Access denied to this channel")
        
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
    
    # ¡Pieza Clave! Retransmitimos el mensaje ya guardado a todos los clientes del WebSocket
    await manager.broadcast(saved_message, str(channel_id))
    
    return saved_message


@router.put("/channels/{channel_id}/messages/{message_id}", response_model=Message)
async def update_message(
    channel_id: UUID,
    message_id: UUID,
    msg_in: MessageUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Edita un mensaje existente y actualiza la notificación (alerta) correspondiente."""
    admin_supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY, options=ClientOptions(schema="dev"))
    
    # 1. Verificar si el mensaje existe y pertenece al usuario
    msg_res = admin_supabase.table("messages").select("*").eq("id", str(message_id)).eq("channel_id", str(channel_id)).execute()
    if not msg_res.data:
        raise HTTPException(status_code=404, detail="Message not found")
        
    original_msg = msg_res.data[0]
    if original_msg["sender_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to edit this message")
        
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
    current_user: dict = Depends(get_current_user)
):
    """Elimina un mensaje y sus notificaciones correspondientes."""
    admin_supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY, options=ClientOptions(schema="dev"))
    
    # 1. Verificar si el mensaje existe y pertenece al usuario
    msg_res = admin_supabase.table("messages").select("*").eq("id", str(message_id)).eq("channel_id", str(channel_id)).execute()
    if not msg_res.data:
        raise HTTPException(status_code=404, detail="Message not found")
        
    original_msg = msg_res.data[0]
    if original_msg["sender_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this message")
        
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
            # Si el cliente nos envía algo directo por el socket (como la página local test_ws.html), 
            # simplemente lo re-emitimos. En producción pura, podríamos ignorarlo 
            # obligándole a usar el endpoint POST para escribir.
            await manager.broadcast({"channel_id": channel_id, "data": data, "type": "echo_test"}, channel_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel_id)
