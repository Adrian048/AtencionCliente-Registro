"""Field-level encryption for customer data (AES-256-GCM).

The database only ever stores ciphertext for personal data; only the API, which
holds the key, can read it.

- One 32-byte master key (a Docker secret) is split with HKDF into two independent
  subkeys: one for encryption and one for the blind index.
- Each value gets a random 96-bit nonce. Stored format:
      version (1 byte) | nonce (12 bytes) | ciphertext + GCM tag (16 bytes)
  The version byte leaves room for key rotation.
- The column name is used as associated data (AAD): a ciphertext copied from the
  ``email`` column into ``nombre`` fails to decrypt instead of being shown.
- The blind index is HMAC-SHA256 of the normalised email. It allows exact-match
  lookups without being able to recover the email from it.
"""

import base64
import hashlib
import hmac
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

KEY_VERSION = 1
_NONCE_BYTES = 12


class DecryptionError(Exception):
    """Ciphertext was tampered with, belongs to another column or another key."""


def _derive(master_key: bytes, purpose: bytes) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=b"triage:" + purpose).derive(
        master_key
    )


def generate_master_key() -> str:
    """New random master key, base64-encoded for storing as a secret file."""
    return base64.b64encode(os.urandom(32)).decode()


class FieldCipher:
    def __init__(self, master_key_b64: str) -> None:
        try:
            master_key = base64.b64decode(master_key_b64, validate=True)
        except ValueError as e:
            raise ValueError("Data encryption key must be base64") from e
        if len(master_key) != 32:
            raise ValueError("Data encryption key must be 32 bytes (256 bits)")
        self._aead = AESGCM(_derive(master_key, b"encryption"))
        self._index_key = _derive(master_key, b"blind-index")

    def encrypt(self, plaintext: str, column: str) -> bytes:
        nonce = os.urandom(_NONCE_BYTES)
        ciphertext = self._aead.encrypt(nonce, plaintext.encode(), column.encode())
        return bytes([KEY_VERSION]) + nonce + ciphertext

    def decrypt(self, blob: bytes, column: str) -> str:
        if len(blob) < 1 + _NONCE_BYTES + 16 or blob[0] != KEY_VERSION:
            raise DecryptionError(f"Unsupported ciphertext in column {column!r}")
        nonce, ciphertext = blob[1 : 1 + _NONCE_BYTES], blob[1 + _NONCE_BYTES :]
        try:
            return self._aead.decrypt(nonce, ciphertext, column.encode()).decode()
        except InvalidTag as e:
            raise DecryptionError(f"Cannot decrypt column {column!r}") from e

    def encrypt_optional(self, plaintext: str | None, column: str) -> bytes | None:
        return None if plaintext is None else self.encrypt(plaintext, column)

    def decrypt_optional(self, blob: bytes | None, column: str) -> str | None:
        return None if blob is None else self.decrypt(blob, column)

    def blind_index(self, email: str) -> bytes:
        normalised = email.strip().lower().encode()
        return hmac.new(self._index_key, normalised, hashlib.sha256).digest()
