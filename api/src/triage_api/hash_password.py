"""CLI: print a scrypt hash for TRIAGE_ADMIN_PASSWORD_HASH.

Usage: python -m triage_api.hash_password
"""

from getpass import getpass

from triage_api.passwords import hash_password


def main() -> None:
    password = getpass("Admin password: ")
    if len(password) < 12:
        raise SystemExit("Use at least 12 characters.")
    if password != getpass("Repeat: "):
        raise SystemExit("Passwords do not match.")
    print(hash_password(password))


if __name__ == "__main__":
    main()
