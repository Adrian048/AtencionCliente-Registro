"""FastAPI application factory."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware

from triage_api import __version__, auth, ingest, tickets
from triage_api.auth import LoginThrottle
from triage_api.config import Settings, get_settings
from triage_api.repository import TicketRepository
from triage_api.security_headers import SecurityHeadersMiddleware


def create_app(
    settings: Settings | None = None, repository: TicketRepository | None = None
) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if repository is not None:
            app.state.repository = repository
            yield
            return

        from psycopg_pool import ConnectionPool

        from triage_api.crypto import FieldCipher
        from triage_api.repository import PostgresTicketRepository

        cipher = FieldCipher(settings.data_encryption_key.get_secret_value())
        # check: validate each connection before handing it out, so a database
        # restart doesn't surface as a failed request on a stale connection.
        pool = ConnectionPool(
            settings.conninfo,
            min_size=1,
            max_size=5,
            open=True,
            check=ConnectionPool.check_connection,
        )
        app.state.repository = PostgresTicketRepository(pool, cipher, settings.search_scan_limit)
        try:
            yield
        finally:
            pool.close()

    app = FastAPI(
        title="triage-api",
        version=__version__,
        lifespan=lifespan,
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
    )
    app.state.login_throttle = LoginThrottle(
        settings.login_max_attempts, settings.login_window_seconds
    )
    app.dependency_overrides[get_settings] = lambda: settings

    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret.get_secret_value(),
        session_cookie="triage_session",
        max_age=settings.session_max_age_seconds,
        same_site="strict",  # with JSON-only endpoints, this is the CSRF defence
        https_only=settings.cookie_secure,
    )
    app.add_middleware(SecurityHeadersMiddleware)

    @app.get("/api/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth.router)
    app.include_router(tickets.router)
    app.include_router(ingest.router)
    return app
