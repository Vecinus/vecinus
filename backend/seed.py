import os
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
import uuid

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("Error: SUPABASE_URL or SUPABASE_SERVICE_KEY not found in .env")
    exit(1)

# Initialize Supabase client targeting the 'dev' schema, using the service_role key to bypass RLS
options = ClientOptions(schema="dev")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY, options=options)

def populate_db():
    print("Iniciando la población de datos en Supabase (schema 'dev')...")

    # 1. Obtenemos el ID del usuario actual de la tabla auth.users usando el cliente principal (public)
    # Como el cliente actual apunta a dev, vamos a usar uno temporal apuntando a public para no liar
    public_supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    # Asumimos que el usuario 'prueba1@prueba.com' que creaste ya existe en la base de datos Auth
    # NOTA: supabase-py no tiene forma sencilla de listar usuarios de Auth sin la service_key, 
    # así que necesitamos que el usuario nos pase el ID que obtuvo en el token.
    # Por suerte, lo tenemos en el output anterior: "e952e472-6a23-4606-817c-e52f955e5287"
    
    user_id = "e952e472-6a23-4606-817c-e52f955e5287"
    
    # Comprobamos si el perfil ya existe
    profile_check = supabase.table("profiles").select("*").eq("id", user_id).execute()
    if not profile_check.data:
        print(f"Creando perfil para el usuario {user_id}...")
        supabase.table("profiles").insert({
            "id": user_id,
            "username": "prueba1"
        }).execute()
    else:
        print("El perfil ya existe, omitiendo...")

    # Creamos otro usuario ficticio para poder tener conversaciones
    # NOTA: supabase-py admin.create_user requires the service_role key
    user2_email = "vecino2@prueba.com"
    user2_password = "tu_password"
    
    print(f"Creando usuario simulado en Auth...")
    try:
        user2_res = public_supabase.auth.admin.create_user({
            "email": user2_email,
            "password": user2_password,
            "email_confirm": True
        })
        user2_id = user2_res.user.id
    except Exception as e:
        print(f"Aviso al crear user2 en Auth (quizás ya existe): {e}")
        # Intentamos obtener su ID si ya existía
        # Para simplificar en pruebas locales si falla, generamos uuid al azar y cruzamos dedos o mostramos error
        print("Saltando inserción de mock Auth. Si falla RLS abajo, elimina los usuarios de Auth y vuelve a correr seed.")
        user2_id = str(uuid.uuid4())

    profile2_check = supabase.table("profiles").select("*").eq("username", "vecino2_simulado").execute()
    if not profile2_check.data:
        print(f"Creando perfil simulado {user2_id}...")
        supabase.table("profiles").insert({
            "id": user2_id,
            "username": "vecino2_simulado"
        }).execute()
    else:
        print("El perfil simulado ya existe, obteniendo su ID...")
        user2_id = profile2_check.data[0]["id"]


    # 2. Crear una Comunidad
    print("Creando comunidad...")
    community_res = supabase.table("communities").insert({
        "name": "Comunidad de Prueba",
        "address": "Calle Falsa 123"
    }).execute()
    community_id = community_res.data[0]["id"]

    # 3. Añadir a los usuarios como miembros de la comunidad
    print("Añadiendo miembros a la comunidad...")
    supabase.table("community_members").insert([
        {"community_id": community_id, "user_id": user_id, "role": "admin"},
        {"community_id": community_id, "user_id": user2_id, "role": "neighbor"}
    ]).execute()

    # 4. Crear Canales de Chat
    print("Creando canales de chat...")
    channel_general = supabase.table("chat_channels").insert({
        "community_id": community_id,
        "name": "Canal General",
        "is_direct_message": False
    }).execute()
    channel_general_id = channel_general.data[0]["id"]
    
    channel_dm = supabase.table("chat_channels").insert({
        "community_id": community_id,
        "name": None, # Los DMs no suelen tener nombre
        "is_direct_message": True
    }).execute()
    channel_dm_id = channel_dm.data[0]["id"]

    # 5. Añadir a los usuarios a los Canales
    print("Añadiendo participantes a los canales...")
    # Todos al general
    supabase.table("channel_participants").insert([
        {"channel_id": channel_general_id, "user_id": user_id},
        {"channel_id": channel_general_id, "user_id": user2_id}
    ]).execute()
    
    # DM entre usuario 1 y usuario 2
    supabase.table("channel_participants").insert([
        {"channel_id": channel_dm_id, "user_id": user_id},
        {"channel_id": channel_dm_id, "user_id": user2_id}
    ]).execute()

    # 6. Añadir algunos mensajes
    print("Insertando mensajes de prueba...")
    supabase.table("messages").insert([
        {"channel_id": channel_general_id, "sender_id": user_id, "content": "¡Hola vecinos! Bienvenidos al nuevo chat :D"},
        {"channel_id": channel_general_id, "sender_id": user2_id, "content": "Hola!! Qué buena idea esto del chat de la comunidad."},
        {"channel_id": channel_dm_id, "sender_id": user_id, "content": "Hola vecino, ¿podrías hacer menos ruido por las noches?"},
        {"channel_id": channel_dm_id, "sender_id": user2_id, "content": "¡Ay perdona! No me había dado cuenta de que se escuchaba tanto... :("}
    ]).execute()

    # 7. Añadir algunas alertas (Notificaciones de chat) para el usuario principal
    print("Insertando alertas de prueba...")
    supabase.table("alerts").insert([
        {
            "user_id": user_id, 
            "title": "Nuevo mensaje de vecino2_simulado", 
            "content": "Hola!! Qué buena idea esto del chat de la comunidad.",
            "is_read": False
        },
        {
            "user_id": user_id, 
            "title": "Nuevo mensaje de vecino2_simulado", 
            "content": "¡Ay perdona! No me había dado cuenta de que se escuchaba tanto... :(",
            "is_read": True
        }
    ]).execute()

    print("\n¡Datos de prueba insertados con éxito!")

if __name__ == "__main__":
    populate_db()
