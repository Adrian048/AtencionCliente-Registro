from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.conftest import INGEST_KEY

VALID: dict[str, Any] = {
    "nombre": "Ana",
    "apellidos": "Ruiz Sanz",
    "email": "ana@example.com",
    "consulta": "Queremos un presupuesto para un pentest de nuestra web.",
    "categoria": "presupuesto",
    "prioridad": "media",
    "sentimiento": "neutro",
    "resumen": "Presupuesto de pentest web",
    "confianza": 0.93,
    "estado": "nuevo",
}
HEADERS = {"X-Ingest-Key": INGEST_KEY}


def test_ingest_creates_ticket_visible_in_panel(
    client: TestClient, auth_client: TestClient
) -> None:
    response = client.post("/api/internal/tickets", json=VALID, headers=HEADERS)

    assert response.status_code == 201
    ticket = auth_client.get(f"/api/tickets/{response.json()['id']}").json()
    assert ticket["email"] == "ana@example.com"
    assert ticket["categoria"] == "presupuesto"


@pytest.mark.parametrize("headers", [{}, {"X-Ingest-Key": "wrong"}, {"X-Ingest-Key": ""}])
def test_ingest_requires_valid_key(client: TestClient, headers: dict[str, str]) -> None:
    assert client.post("/api/internal/tickets", json=VALID, headers=headers).status_code == 401


def test_panel_session_is_not_enough_for_ingest(auth_client: TestClient) -> None:
    assert auth_client.post("/api/internal/tickets", json=VALID).status_code == 401


@pytest.mark.parametrize(
    "override",
    [
        {"categoria": "hackeado"},
        {"email": "no-es-un-email"},
        {"consulta": "corta"},
        {"confianza": 1.5},
        {"estado": "resuelto"},  # a new ticket can't arrive already resolved
        {"extra": "campo"},  # unknown fields are rejected
        {"nombre": "x" * 101},
    ],
)
def test_ingest_validates_payload(client: TestClient, override: dict[str, Any]) -> None:
    payload = VALID | override

    assert client.post("/api/internal/tickets", json=payload, headers=HEADERS).status_code == 422
