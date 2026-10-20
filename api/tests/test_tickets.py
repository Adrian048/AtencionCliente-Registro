from fastapi.testclient import TestClient

from triage_api.config import Settings
from triage_api.main import create_app
from triage_api.repository import InMemoryTicketRepository, _where
from triage_api.schemas import Categoria, TicketFilters


def test_list_returns_newest_first(auth_client: TestClient) -> None:
    body = auth_client.get("/api/tickets").json()

    assert body["total"] == 4
    assert [t["id"] for t in body["items"]] == [4, 3, 2, 1]


def test_list_filters_by_categoria_prioridad_estado(auth_client: TestClient) -> None:
    by_cat = auth_client.get("/api/tickets", params={"categoria": "presupuesto"}).json()
    by_prio = auth_client.get("/api/tickets", params={"prioridad": "urgente"}).json()
    by_estado = auth_client.get("/api/tickets", params={"estado": "descartado"}).json()

    assert [t["id"] for t in by_cat["items"]] == [2]
    assert [t["id"] for t in by_prio["items"]] == [3]
    assert [t["id"] for t in by_estado["items"]] == [4]


def test_list_text_search(auth_client: TestClient) -> None:
    body = auth_client.get("/api/tickets", params={"q": "servidor"}).json()

    assert [t["id"] for t in body["items"]] == [3]


def test_list_pagination(auth_client: TestClient) -> None:
    body = auth_client.get("/api/tickets", params={"page": 2, "size": 3}).json()

    assert body["total"] == 4
    assert [t["id"] for t in body["items"]] == [1]


def test_list_rejects_unknown_enum_values(auth_client: TestClient) -> None:
    response = auth_client.get("/api/tickets", params={"categoria": "' OR 1=1 --"})

    assert response.status_code == 422


def test_get_ticket_and_404(auth_client: TestClient) -> None:
    assert auth_client.get("/api/tickets/2").json()["categoria"] == "presupuesto"
    assert auth_client.get("/api/tickets/999").status_code == 404


def test_update_estado(auth_client: TestClient) -> None:
    response = auth_client.patch("/api/tickets/1", json={"estado": "resuelto"})

    assert response.status_code == 200
    assert response.json()["estado"] == "resuelto"
    assert auth_client.get("/api/tickets/1").json()["estado"] == "resuelto"


def test_update_only_allows_estado(auth_client: TestClient) -> None:
    # Mass assignment: extra fields are rejected, not silently ignored.
    response = auth_client.patch("/api/tickets/1", json={"estado": "resuelto", "categoria": "spam"})

    assert response.status_code == 422


def test_stats(auth_client: TestClient) -> None:
    body = auth_client.get("/api/stats").json()

    assert body["total"] == 4
    assert body["por_categoria"]["ciberseguridad"] == 1
    assert body["por_prioridad"]["urgente"] == 1
    assert body["por_estado"]["nuevo"] == 2


def test_security_headers_and_no_server_header(client: TestClient) -> None:
    headers = client.get("/api/health").headers

    assert headers["x-content-type-options"] == "nosniff"
    assert headers["x-frame-options"] == "DENY"
    assert "server" not in headers


def test_docs_disabled_in_prod(settings: Settings) -> None:
    prod = settings.model_copy(update={"env": "prod"})
    with TestClient(create_app(prod, InMemoryTicketRepository())) as client:
        assert client.get("/docs").status_code == 404
        assert client.get("/openapi.json").status_code == 404


def test_sql_where_binds_values_and_never_uses_free_text() -> None:
    where, params = _where(TicketFilters(categoria=Categoria.INCIDENCIA), email_bidx=b"" * 32)

    assert params == {"categoria": "incidencia", "email_bidx": b"" * 32}
    assert "incidencia" not in repr(where)


def test_search_by_email_is_exact(auth_client: TestClient) -> None:
    exact = auth_client.get("/api/tickets", params={"q": "LUCIA2@example.com"}).json()
    partial = auth_client.get("/api/tickets", params={"q": "lucia@example"}).json()

    assert [t["id"] for t in exact["items"]] == [2]
    assert partial["total"] == 0
