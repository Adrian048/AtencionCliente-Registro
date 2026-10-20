"""Entry point for uvicorn: ``uvicorn triage_api.asgi:app``."""

from triage_api.main import create_app

app = create_app()
