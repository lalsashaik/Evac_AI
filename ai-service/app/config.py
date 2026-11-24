import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseModel):
    service_name: str = "evacai-ai-service"
    environment: str = os.getenv("ENVIRONMENT", "development")
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    backend_api_url: str = os.getenv("BACKEND_API_URL", "http://localhost:4000/api")
    ai_service_key: str = os.getenv("AI_SERVICE_KEY", "dev_secret_key")
    confidence_threshold: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.50"))
    cooldown_seconds: int = int(os.getenv("COOLDOWN_SECONDS", "30"))

settings = Settings()
