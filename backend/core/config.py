import os

from dotenv import load_dotenv

# Carga las variables desde el .env situado en la carpeta backend,
# independientemente del directorio desde el que se ejecute el servidor.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(ENV_PATH)


def _clean_url(value: str) -> str:
    # Defensa contra valores del .env / Render dashboard pegados con comentarios
    # o comillas envolventes (p.ej. 'http://x "  # nota'). Corta en el primer
    # espacio o '#' tras la URL y quita comillas y barras finales.
    cleaned = value.strip().strip('"').strip("'")
    for sep in ("#", " ", "\t"):
        idx = cleaned.find(sep)
        if idx != -1:
            cleaned = cleaned[:idx]
    return cleaned.strip().strip('"').strip("'").rstrip("/")


class Settings:
    PROJECT_NAME: str = "VecinUs Backend"
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    PINECONE_API_KEY: str = os.getenv("PINECONE_API_KEY", "")
    PINECONE_INDEX_NAME: str = os.getenv("PINECONE_INDEX_NAME", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")
    SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    APP_BASE_URL: str = _clean_url(os.getenv("APP_BASE_URL", "http://localhost:8081"))
    SUPABASE_SCHEMA: str = os.getenv("SUPABASE_SCHEMA", "dev_s2")
    CLOUDINARY_URL: str = os.getenv("CLOUDINARY_URL", "")
    GOCARDLESS_ACCESS_TOKEN: str = os.getenv("GOCARDLESS_ACCESS_TOKEN", "")
    GOCARDLESS_BASE_URL: str = os.getenv("GOCARDLESS_BASE_URL", "https://api-sandbox.gocardless.com")
    GOCARDLESS_VERSION: str = os.getenv("GOCARDLESS_VERSION", "2015-07-06")
    GOCARDLESS_SCHEME: str = os.getenv("GOCARDLESS_SCHEME", "sepa_core")
    GOCARDLESS_EXIT_URI: str = _clean_url(
        os.getenv("GOCARDLESS_EXIT_URI", "http://localhost:8081/payments/gocardless/cancel")
    )
    GOCARDLESS_WEBHOOK_SECRET: str = os.getenv("GOCARDLESS_WEBHOOK_SECRET", "")
    MULTICOMMUNITY_CURRENCY: str = os.getenv("MULTICOMMUNITY_CURRENCY", "EUR")
    REGISTRATION_PAYMENT_AMOUNT_CENTS: int = int(os.getenv("REGISTRATION_PAYMENT_AMOUNT_CENTS", "3000"))

    BASIC_PLAN_BASE_CENTS: int = int(os.getenv("BASIC_PLAN_BASE_CENTS", "2000"))
    BASIC_PLAN_PER_HOUSEHOLD_CENTS: int = int(os.getenv("BASIC_PLAN_PER_HOUSEHOLD_CENTS", "20"))
    BASIC_MINUTES_HOURS: int = int(os.getenv("BASIC_MINUTES_HOURS", "2"))
    BASIC_MINUTES_CARRYOVER_CAP_HOURS: int = int(os.getenv("BASIC_MINUTES_CARRYOVER_CAP_HOURS", "10"))
    BASIC_CHATBOT_BASE_MSG: int = int(os.getenv("BASIC_CHATBOT_BASE_MSG", "500"))
    BASIC_CHATBOT_PER_HOUSEHOLD_MSG: int = int(os.getenv("BASIC_CHATBOT_PER_HOUSEHOLD_MSG", "5"))

    PREMIUM_PLAN_BASE_CENTS: int = int(os.getenv("PREMIUM_PLAN_BASE_CENTS", "3000"))
    PREMIUM_PLAN_PER_HOUSEHOLD_CENTS: int = int(os.getenv("PREMIUM_PLAN_PER_HOUSEHOLD_CENTS", "50"))
    PREMIUM_MINUTES_HOURS: int = int(os.getenv("PREMIUM_MINUTES_HOURS", "4"))
    PREMIUM_MINUTES_CARRYOVER_CAP_HOURS: int = int(os.getenv("PREMIUM_MINUTES_CARRYOVER_CAP_HOURS", "20"))
    PREMIUM_CHATBOT_BASE_MSG: int = int(os.getenv("PREMIUM_CHATBOT_BASE_MSG", "1000"))
    PREMIUM_CHATBOT_PER_HOUSEHOLD_MSG: int = int(os.getenv("PREMIUM_CHATBOT_PER_HOUSEHOLD_MSG", "10"))

    CHATBOT_INPUT_CHAR_LIMIT: int = int(os.getenv("CHATBOT_INPUT_CHAR_LIMIT", "300"))
    CHATBOT_OUTPUT_CHAR_LIMIT: int = int(os.getenv("CHATBOT_OUTPUT_CHAR_LIMIT", "1000"))


settings = Settings()
