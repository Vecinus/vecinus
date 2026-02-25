import os
from dotenv import load_dotenv

# Carga las variables desde el .env
load_dotenv()

class Settings:
    PROJECT_NAME: str = "VecinUs Backend"
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")

settings = Settings()