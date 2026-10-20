"""Integration tests against a real PostgreSQL with the project's schema and roles.

Skipped unless TRIAGE_TEST_ADMIN_DSN (superuser, to reset and inspect the table)
and TRIAGE_TEST_API_DSN (the least-privileged panel_api role) are set. CI sets both.
"""

import os
from collections.abc import Iterator

import psycopg
import pytest
from psycopg_pool import ConnectionPool

from triage_api.crypto import FieldCipher, generate_master_key
from triage_api.repository import PostgresTicketRepository
from triage_api.schemas import Categoria, Estado, Prioridad, TicketFilters, TicketIngest

ADMIN_DSN = os.environ.get("TRIAGE_TEST_ADMIN_DSN")
API_DSN = os.environ.get("TRIAGE_TEST_API_DSN")

pytestmark = pytest.mark.skipif(not (ADMIN_DSN and API_DSN), reason="no test database")

SEED = [
    TicketIngest(
        nombre="Ana", apellidos="Ruiz", email="ana@example.com",
        consulta="Necesito presupuesto para un pentest web externo.",
        categoria=Categoria.PRESUPUESTO, prioridad=Prioridad.MEDIA,
        resumen="Presupuesto pentest",
    ),
    TicketIngest(
        nombre="Luis", apellidos="Mora", email="luis@example.com",
        consulta="Nuestro servidor de correo ha caído, es urgente.",
        categoria=Categoria.INCIDENCIA, prioridad=Prioridad.URGENTE,
    ),
    TicketIngest(
        nombre="Eva", apellidos="Sanz", email="eva@example.com",
        consulta="¿Podéis integrar un chatbot con IA en la intranet?",
        categoria=Categoria.INTELIGENCIA_ARTIFICIAL, prioridad=Prioridad.MEDIA,
    ),
]  # fmt: skip


@pytest.fixture
def repo() -> Iterator[PostgresTicketRepository]:
    assert ADMIN_DSN and API_DSN
    with psycopg.connect(ADMIN_DSN, autocommit=True) as conn:
        conn.execute("TRUNCATE tickets RESTART IDENTITY")
    pool = ConnectionPool(API_DSN, min_size=1, max_size=2)
    repository = PostgresTicketRepository(pool, FieldCipher(generate_master_key()), 1000)
    for ticket in SEED:
        repository.create(ticket)
    try:
        yield repository
    finally:
        pool.close()


def test_database_never_stores_personal_data_in_clear(repo: PostgresTicketRepository) -> None:
    assert ADMIN_DSN
    with psycopg.connect(ADMIN_DSN) as conn:
        dump = " ".join(
            str(value) for row in conn.execute("SELECT * FROM tickets").fetchall() for value in row
        )
    for seed in SEED:
        for secret in (seed.nombre, seed.apellidos, seed.email, seed.consulta):
            assert secret not in dump
    assert "pentest" not in dump.lower()


def test_list_decrypts_and_filters(repo: PostgresTicketRepository) -> None:
    assert repo.list(TicketFilters()).total == 3
    page = repo.list(TicketFilters(categoria=Categoria.INCIDENCIA))
    assert [(t.nombre, t.email) for t in page.items] == [("Luis", "luis@example.com")]


def test_search_free_text_and_exact_email(repo: PostgresTicketRepository) -> None:
    assert [t.nombre for t in repo.list(TicketFilters(q="chatbot")).items] == ["Eva"]
    assert [t.nombre for t in repo.list(TicketFilters(q="ANA@example.com")).items] == ["Ana"]
    assert repo.list(TicketFilters(q="ana@example")).total == 0


def test_update_estado_and_stats(repo: PostgresTicketRepository) -> None:
    updated = repo.update_estado(2, Estado.EN_CURSO)

    assert updated is not None and updated.estado is Estado.EN_CURSO
    assert updated.nombre == "Luis"
    assert repo.stats().por_estado == {"nuevo": 2, "en_curso": 1}


def test_api_role_cannot_tamper_or_delete(repo: PostgresTicketRepository) -> None:
    assert API_DSN
    with psycopg.connect(API_DSN) as conn:
        for statement in (
            "UPDATE tickets SET categoria = 'spam'",
            "UPDATE tickets SET email_enc = 'x'",
            "DELETE FROM tickets",
            "DROP TABLE tickets",
        ):
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                conn.execute(statement)
            conn.rollback()
