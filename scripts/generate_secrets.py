"""Create the Docker secret files in ./secrets (one file per secret).

Usage:
    python scripts/generate_secrets.py            # asks for the panel admin password
    python scripts/generate_secrets.py --no-admin # CI: leaves the admin hash empty

Existing files are never overwritten unless --force is given. Be careful with
``triage_data_encryption_key``: replacing it makes every stored ticket unreadable,
and ``n8n_encryption_key``: replacing it makes the credentials saved in n8n unreadable.

The ./secrets folder is git-ignored, outside any web root and never copied into an
image; containers see each file read-only under /run/secrets/.
"""

import argparse
import base64
import os
import secrets
import sys
from getpass import getpass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SECRETS_DIR = ROOT / "secrets"
sys.path.insert(0, str(ROOT / "api" / "src"))

from triage_api.passwords import hash_password  # noqa: E402  (stdlib-only module)


def token() -> str:
    return secrets.token_urlsafe(32)


def aes_key() -> str:
    return base64.b64encode(os.urandom(32)).decode()


GENERATED = {
    "postgres_password": token,  # Postgres superuser (only used by the init scripts)
    "api_db_password": token,  # role panel_api
    "n8n_encryption_key": token,  # encrypts the credentials stored in n8n (Claude key...)
    "triage_session_secret": token,  # signs the panel session cookie
    "triage_data_encryption_key": aes_key,  # AES-256 master key for customer data
    "triage_ingest_api_key": token,  # n8n -> API internal endpoint
    "webhook_api_key": token,  # public form -> n8n webhook
}
ADMIN_HASH = "triage_admin_password_hash"


def write_secret(name: str, value: str, force: bool) -> None:
    path = SECRETS_DIR / name
    existed = path.exists()
    if existed and not force:
        print(f"  keep    {name}")
        return
    path.write_text(value, encoding="utf-8", newline="")
    # Readable inside the containers (non-root users); the folder itself is private.
    path.chmod(0o644)
    print(f"  {'replace' if existed else 'create'}  {name}")


def ask_admin_password() -> str:
    while True:
        password = getpass("Panel admin password (min. 12 characters): ")
        if len(password) < 12:
            print("Too short.")
        elif password != getpass("Repeat: "):
            print("Passwords do not match.")
        else:
            return hash_password(password)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="overwrite existing secrets")
    parser.add_argument("--no-admin", action="store_true", help="don't ask for the admin password")
    args = parser.parse_args()

    SECRETS_DIR.mkdir(exist_ok=True)
    SECRETS_DIR.chmod(0o700)
    print(f"Secrets in {SECRETS_DIR}")
    for name, generate in GENERATED.items():
        write_secret(name, generate(), args.force)

    admin = SECRETS_DIR / ADMIN_HASH
    if args.no_admin:
        if not admin.exists():
            write_secret(ADMIN_HASH, "", force=False)
    elif not admin.exists() or not admin.read_text().strip() or args.force:
        write_secret(ADMIN_HASH, ask_admin_password(), force=True)
    else:
        print(f"  keep    {ADMIN_HASH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
