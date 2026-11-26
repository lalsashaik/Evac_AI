import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent

def resolve_evidence_dir() -> str:
    env_val = os.getenv("EVACAI_EVIDENCE_DIR") or os.getenv("EVIDENCE_DIR")
    if env_val:
        p = Path(env_val)
        if p.is_absolute():
            resolved = p.resolve()
        else:
            cand_cwd = (Path.cwd() / env_val).resolve()
            cand_proj = (PROJECT_ROOT / env_val).resolve()
            cand_base = (BASE_DIR / env_val).resolve()
            if cand_cwd.exists():
                resolved = cand_cwd
            elif cand_proj.exists():
                resolved = cand_proj
            elif cand_base.exists():
                resolved = cand_base
            else:
                resolved = cand_proj
    else:
        resolved = (PROJECT_ROOT / "evidence").resolve()

    try:
        (resolved / "incidents").mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
    return str(resolved)

class Settings(BaseModel):
    service_name: str = "evacai-ai-service"
    environment: str = os.getenv("ENVIRONMENT", "development")
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    backend_api_url: str = os.getenv("BACKEND_API_URL", "http://localhost:4000/api")
    ai_service_key: str = os.getenv("AI_SERVICE_KEY", "evacai_dev_secret_key_change_in_production")
    
    # Model configuration
    model_path: str = os.getenv("MODEL_PATH", str(BASE_DIR / "models" / "fire_smoke_yolov8n.pt"))
    confidence_threshold: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.60"))
    
    # Video & Inference performance
    frame_interval_seconds: float = float(os.getenv("FRAME_INTERVAL_SECONDS", "1.0"))
    cooldown_seconds: int = int(os.getenv("COOLDOWN_SECONDS", "900"))
    max_recent_events: int = int(os.getenv("MAX_RECENT_EVENTS", "100"))
    evidence_dir: str = resolve_evidence_dir()
    auto_sync_cameras: bool = os.getenv("AUTO_SYNC_CAMERAS", "false").lower() in ("true", "1", "yes")

    # Real-time detection state & auto-clearing (M8)
    detection_clearing_seconds: float = float(os.getenv("DETECTION_CLEARING_SECONDS", "15.0"))
    detection_grace_period_seconds: float = float(os.getenv("DETECTION_GRACE_PERIOD_SECONDS", "3.0"))

    # Base workspace reference for resolving relative video URLs (e.g., /videos/sample.mp4)
    workspace_root: str = str(PROJECT_ROOT)

settings = Settings()
