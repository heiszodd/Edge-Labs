import logging
import os
from pathlib import Path

from dotenv import load_dotenv

# Load both root and backend env files when present.
_ROOT = Path(__file__).resolve().parents[1]
for _env_file in (_ROOT / ".env", _ROOT / "backend" / ".env"):
    if _env_file.exists():
        load_dotenv(_env_file, override=(_env_file.name == ".env" and _env_file.parent.name == "backend"))


def _normalize_url(value: str, default_scheme: str = "https") -> str:
    raw = (value or "").strip().rstrip("/")
    if not raw:
        return ""
    if raw.startswith(("http://", "https://")):
        return raw
    return f"{default_scheme}://{raw}"

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "")
FRONTEND_URL = _normalize_url(os.getenv("FRONTEND_URL", "http://localhost:5173"), default_scheme="https")
FRONTEND_URLS = [_normalize_url(u, default_scheme="https") for u in os.getenv("FRONTEND_URLS", "").split(",") if u.strip()]
if FRONTEND_URL and FRONTEND_URL not in FRONTEND_URLS:
    FRONTEND_URLS.append(FRONTEND_URL)
CORS_ORIGIN_REGEX = os.getenv("CORS_ORIGIN_REGEX", "").strip() or None
ALLOW_ALL_CORS = os.getenv("ALLOW_ALL_CORS", "false").strip().lower() in {"1", "true", "yes", "on"}
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
HELIUS_RPC_URL = os.getenv("HELIUS_RPC_URL", "https://api.mainnet-beta.solana.com")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
BACKEND_URL = _normalize_url(os.getenv("BACKEND_URL", "http://localhost:8000"), default_scheme="https")
SERVICE_SECRET = os.getenv("SERVICE_SECRET", "")
ADMIN_BOOTSTRAP_EMAIL = os.getenv("ADMIN_BOOTSTRAP_EMAIL", "").strip().lower()
ADMIN_BOOTSTRAP_PASSWORD = os.getenv("ADMIN_BOOTSTRAP_PASSWORD", "")
ADMIN_BOOTSTRAP_USERNAME = os.getenv("ADMIN_BOOTSTRAP_USERNAME", "admin")
AUTO_PROMOTE_FIRST_USER_ADMIN = os.getenv("AUTO_PROMOTE_FIRST_USER_ADMIN", "true").strip().lower() in {"1", "true", "yes", "on"}

if not TELEGRAM_BOT_TOKEN:
    logging.warning("TELEGRAM_BOT_TOKEN not set; Telegram integration will be disabled.")
if not SUPABASE_URL or not (SUPABASE_SERVICE_KEY or SUPABASE_KEY):
    raise RuntimeError("Supabase env vars not set")
if not ENCRYPTION_KEY:
    logging.warning("ENCRYPTION_KEY not set - using ephemeral key. Keys will be lost on restart.")
