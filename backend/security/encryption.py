from cryptography.fernet import Fernet

from backend.config import ENCRYPTION_KEY

if ENCRYPTION_KEY:
    _fernet = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
else:
    _fernet = Fernet(Fernet.generate_key())


def encrypt_secret(plain: str) -> str:
    return _fernet.encrypt(plain.encode()).decode()


def decrypt_secret(token: str) -> str:
    return _fernet.decrypt(token.encode()).decode()
