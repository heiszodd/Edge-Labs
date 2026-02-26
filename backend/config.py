import logging
import os
from pathlib import Path

from dotenv import load_dotenv

# Load both root and backend env files when present.
_ROOT = Path(__file__).resolve().parents[1]
for _env_file in (_ROOT / ".env", _ROOT / "backend" / ".env"):
    if _env_file.exists():
        load_dotenv(_env_file, override=False)

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").strip().rstrip("/")
FRONTEND_URLS = [u.strip().rstrip("/") for u in os.getenv("FRONTEND_URLS", "").split(",") if u.strip()]
if FRONTEND_URL and FRONTEND_URL not in FRONTEND_URLS:
    FRONTEND_URLS.append(FRONTEND_URL)
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
HELIUS_RPC_URL = os.getenv("HELIUS_RPC_URL", "https://api.mainnet-beta.solana.com")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000").strip().rstrip("/")
SERVICE_SECRET = os.getenv("SERVICE_SECRET", "")

if not TELEGRAM_BOT_TOKEN:
    logging.warning("TELEGRAM_BOT_TOKEN not set; Telegram integration will be disabled.")
if not SUPABASE_URL or not (SUPABASE_SERVICE_KEY or SUPABASE_KEY):
    raise RuntimeError("Supabase env vars not set")
if not ENCRYPTION_KEY:
    logging.warning("ENCRYPTION_KEY not set - using ephemeral key. Keys will be lost on restart.")
