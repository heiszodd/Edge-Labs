from __future__ import annotations

from backend import db
from backend.security.encryption import decrypt_secret, encrypt_secret


def _detect_format(raw_input: str) -> tuple[str, str]:
    value = " ".join(raw_input.strip().split())
    if not value:
        raise ValueError("Key input is empty")

    words = value.split(" ")
    if len(words) in (12, 24):
        address = f"derived_{abs(hash(value)) % 10**12}"
        return "seed_phrase", address

    if len(value) >= 32 and " " not in value:
        lowered = value.lower()
        if lowered.startswith("0x") and len(value) == 42:
            return "address_only", value
        if lowered.startswith("0x") and len(value) in (43, 44):
            raise ValueError("Invalid address length")
        return "private_key", f"derived_{abs(hash(value)) % 10**12}"

    raise ValueError("Unsupported key format. Provide a 12/24-word seed phrase or private key")


def key_exists(user_id, key_name) -> bool:
    try:
        return db.key_exists(user_id, key_name)
    except Exception:
        return False


def store_private_key(user_id, key_name, raw_input, label, chain) -> dict:
    key_format, address = _detect_format(raw_input)
    encrypted = encrypt_secret(raw_input)
    ok = db.save_encrypted_key(user_id, key_name, encrypted, label or f"{chain} key")
    if not ok:
        raise ValueError("Could not save key")
    return {"address": address, "format": key_format}


def get_private_key(user_id, key_name) -> str:
    token = db.get_encrypted_key(user_id, key_name)
    if not token:
        raise ValueError("Key not found")
    try:
        return decrypt_secret(token)
    except Exception as exc:
        raise ValueError("Stored key could not be decrypted") from exc
