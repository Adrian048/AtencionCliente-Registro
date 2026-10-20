from fastapi.testclient import TestClient

from tests.conftest import ADMIN_PASSWORD
from triage_api.passwords import hash_password, verify_password


def test_password_hash_roundtrip() -> None:
    encoded = hash_password("s3cret-password")

    assert verify_password("s3cret-password", encoded)
    assert not verify_password("wrong", encoded)
    assert not verify_password("s3cret-password", "garbage")


def test_protected_endpoints_require_login(client: TestClient) -> None:
    for path in ("/api/tickets", "/api/tickets/1", "/api/stats", "/api/auth/me"):
        assert client.get(path).status_code == 401, path
    assert client.patch("/api/tickets/1", json={"estado": "resuelto"}).status_code == 401


def test_login_sets_httponly_strict_cookie(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD}
    )

    assert response.status_code == 200
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert "samesite=strict" in cookie
    assert client.get("/api/auth/me").json() == {"username": "admin"}


def test_wrong_credentials_return_generic_401(client: TestClient) -> None:
    bad_pw = client.post("/api/auth/login", json={"username": "admin", "password": "nope"})
    bad_user = client.post("/api/auth/login", json={"username": "root", "password": ADMIN_PASSWORD})

    assert bad_pw.status_code == bad_user.status_code == 401
    assert bad_pw.json() == bad_user.json()  # no user enumeration


def test_login_is_throttled_after_repeated_failures(client: TestClient) -> None:
    for _ in range(3):
        client.post("/api/auth/login", json={"username": "admin", "password": "nope"})

    response = client.post(
        "/api/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD}
    )

    assert response.status_code == 429


def test_logout_clears_session(auth_client: TestClient) -> None:
    assert auth_client.post("/api/auth/logout").status_code == 204
    assert auth_client.get("/api/auth/me").status_code == 401
