from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from triage_api.config import Settings
from triage_api.crypto import generate_master_key
from triage_api.main import create_app
from triage_api.passwords import hash_password
from triage_api.repository import InMemoryTicketRepository
from triage_api.schemas import Categoria, Estado, Prioridad, Ticket

ADMIN_PASSWORD = "correct-horse-battery"
INGEST_KEY = "i" * 40
_HASH = hash_password(ADMIN_PASSWORD)


def make_ticket(id_: int, **overrides: object) -> Ticket:
    base = datetime(2026, 10, 1, 9, 0, tzinfo=UTC) + timedelta(hours=id_)
    data: dict[str, object] = {
        "id": id_,
        "nombre": "Lucía",
        "apellidos": "García Pérez",
        "email": f"lucia{id_}@example.com",
        "consulta": "Necesitamos una auditoría de seguridad de nuestra web corporativa.",
        "categoria": Categoria.CIBERSEGURIDAD,
        "prioridad": Prioridad.MEDIA,
        "sentimiento": "neutro",
        "resumen": "Solicita auditoría de seguridad web",
        "confianza": Decimal("0.91"),
        "estado": Estado.NUEVO,
        "created_at": base,
        "updated_at": base,
    }
    data.update(overrides)
    return Ticket.model_validate(data)


@pytest.fixture
def settings() -> Settings:
    return Settings(
        env="test",
        admin_user="admin",
        admin_password_hash=SecretStr(_HASH),
        session_secret=SecretStr("x" * 32),
        cookie_secure=False,  # TestClient talks plain http
        login_max_attempts=3,
        data_encryption_key=SecretStr(generate_master_key()),
        ingest_api_key=SecretStr(INGEST_KEY),
    )


@pytest.fixture
def repo() -> InMemoryTicketRepository:
    return InMemoryTicketRepository(
        [
            make_ticket(1),
            make_ticket(
                2,
                categoria=Categoria.PRESUPUESTO,
                prioridad=Prioridad.ALTA,
                consulta="Queremos presupuesto para una app de gestión interna.",
            ),
            make_ticket(
                3,
                categoria=Categoria.INCIDENCIA,
                prioridad=Prioridad.URGENTE,
                estado=Estado.EN_CURSO,
                nombre="Marcos",
                consulta="El servidor de producción no responde desde esta mañana.",
            ),
            make_ticket(
                4,
                categoria=Categoria.SPAM,
                prioridad=Prioridad.BAJA,
                estado=Estado.DESCARTADO,
                consulta="Compre seguidores baratos 100%",
            ),
        ]
    )


@pytest.fixture
def client(settings: Settings, repo: InMemoryTicketRepository) -> Iterator[TestClient]:
    with TestClient(create_app(settings, repo)) as c:
        yield c


@pytest.fixture
def auth_client(client: TestClient) -> TestClient:
    response = client.post(
        "/api/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200
    return client
