"""Settings.

Secrets are read from files in ``/run/secrets`` (Docker secrets), never from
environment variables, so they don't show up in ``docker inspect``, process
listings or crash dumps. The file name is the setting name with the ``TRIAGE_``
prefix, e.g. ``/run/secrets/triage_session_secret``.
Non-secret settings can still come from ``TRIAGE_*`` environment variables.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from psycopg.conninfo import make_conninfo
from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

SECRETS_DIR = Path("/run/secrets")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TRIAGE_", extra="ignore")

    env: Literal["dev", "test", "prod"] = "dev"

    # Database (password is a secret)
    db_host: str = "db"
    db_port: int = 5432
    db_name: str = "triage"
    db_user: str = "panel_api"
    db_password: SecretStr = SecretStr("")

    # Panel admin. The password is stored only as a scrypt hash.
    admin_user: str = "admin"
    admin_password_hash: SecretStr = SecretStr("")
    session_secret: SecretStr = Field(min_length=32)
    session_max_age_seconds: int = 8 * 60 * 60
    cookie_secure: bool = True  # set to false only for plain-http local dev

    # Customer data encryption (base64, 32 bytes) and the key n8n uses to submit tickets
    data_encryption_key: SecretStr
    ingest_api_key: SecretStr = Field(min_length=32)

    # Brute-force protection on /api/auth/login
    login_max_attempts: int = 5
    login_window_seconds: int = 15 * 60

    # Free-text search runs over decrypted rows, so it scans at most this many
    # of the most recent tickets that match the other filters.
    search_scan_limit: int = 1000

    @property
    def docs_enabled(self) -> bool:
        return self.env != "prod"

    @property
    def conninfo(self) -> str:
        return make_conninfo(
            host=self.db_host,
            port=self.db_port,
            dbname=self.db_name,
            user=self.db_user,
            password=self.db_password.get_secret_value(),
        )


@lru_cache
def get_settings() -> Settings:
    secrets_dir = SECRETS_DIR if SECRETS_DIR.is_dir() else None
    return Settings(_secrets_dir=secrets_dir)  # type: ignore[call-arg]
