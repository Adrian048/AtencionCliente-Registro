"""Ticket persistence.

``TicketRepository`` is the port the routes depend on. ``PostgresTicketRepository``
is the real adapter; tests use ``InMemoryTicketRepository``.

Customer data (name, surname, email, query text, summary) is stored encrypted with
AES-256-GCM (see ``crypto.py``); the database only ever sees ciphertext. Filtering
by category, priority and state still happens in SQL because those are not
personal data. Text search works like this:
  - a query containing "@" is an exact email lookup through the blind index;
  - anything else is matched in memory over the decrypted rows, scanning at most
    ``search_scan_limit`` of the newest tickets that pass the SQL filters.

All SQL uses bound parameters; identifiers come from fixed lists and are quoted
by psycopg.sql.
"""

from datetime import UTC, datetime
from typing import Any, Protocol

from psycopg import sql
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from triage_api.crypto import FieldCipher
from triage_api.schemas import Estado, Stats, Ticket, TicketFilters, TicketIngest, TicketPage

FILTER_COLUMNS = ("categoria", "prioridad", "estado")
ENCRYPTED_FIELDS = ("nombre", "apellidos", "email", "consulta", "resumen")


class TicketRepository(Protocol):
    def create(self, ticket: TicketIngest) -> int: ...
    def list(self, filters: TicketFilters) -> TicketPage: ...
    def get(self, ticket_id: int) -> Ticket | None: ...
    def update_estado(self, ticket_id: int, estado: Estado) -> Ticket | None: ...
    def stats(self) -> Stats: ...


def is_email_query(q: str) -> bool:
    return "@" in q


def matches_text(ticket: Ticket, q: str) -> bool:
    """Search semantics shared by both repositories."""
    if is_email_query(q):
        return ticket.email.lower() == q.strip().lower()
    needle = q.lower()
    fields = (ticket.nombre, ticket.apellidos, ticket.email, ticket.consulta, ticket.resumen)
    return any(needle in (f or "").lower() for f in fields)


def _paginate(found: list[Ticket], filters: TicketFilters) -> TicketPage:
    start = (filters.page - 1) * filters.size
    return TicketPage(
        items=found[start : start + filters.size],
        total=len(found),
        page=filters.page,
        size=filters.size,
    )


def _where(
    filters: TicketFilters, email_bidx: bytes | None = None
) -> tuple[sql.Composable, dict[str, Any]]:
    clauses: list[sql.Composable] = []
    params: dict[str, Any] = {}
    for column in FILTER_COLUMNS:
        value = getattr(filters, column)
        if value is not None:
            clauses.append(
                sql.SQL("{} = {}").format(sql.Identifier(column), sql.Placeholder(column))
            )
            params[column] = value.value
    if email_bidx is not None:
        clauses.append(sql.SQL("email_bidx = %(email_bidx)s"))
        params["email_bidx"] = email_bidx
    if not clauses:
        return sql.SQL(""), params
    return sql.SQL("WHERE ") + sql.SQL(" AND ").join(clauses), params


class PostgresTicketRepository:
    def __init__(self, pool: ConnectionPool, cipher: FieldCipher, search_scan_limit: int) -> None:
        self._pool = pool
        self._cipher = cipher
        self._scan_limit = search_scan_limit

    def _to_ticket(self, row: dict[str, Any]) -> Ticket:
        c = self._cipher
        return Ticket(
            id=row["id"],
            nombre=c.decrypt(row["nombre_enc"], "nombre"),
            apellidos=c.decrypt(row["apellidos_enc"], "apellidos"),
            email=c.decrypt(row["email_enc"], "email"),
            consulta=c.decrypt(row["consulta_enc"], "consulta"),
            resumen=c.decrypt_optional(row["resumen_enc"], "resumen"),
            categoria=row["categoria"],
            prioridad=row["prioridad"],
            sentimiento=row["sentimiento"],
            confianza=row["confianza"],
            estado=row["estado"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def create(self, ticket: TicketIngest) -> int:
        c = self._cipher
        params = {
            "nombre_enc": c.encrypt(ticket.nombre, "nombre"),
            "apellidos_enc": c.encrypt(ticket.apellidos, "apellidos"),
            "email_enc": c.encrypt(ticket.email, "email"),
            "email_bidx": c.blind_index(ticket.email),
            "consulta_enc": c.encrypt(ticket.consulta, "consulta"),
            "resumen_enc": c.encrypt_optional(ticket.resumen, "resumen"),
            "categoria": ticket.categoria.value,
            "prioridad": ticket.prioridad.value,
            "sentimiento": ticket.sentimiento.value if ticket.sentimiento else None,
            "confianza": ticket.confianza,
            "estado": ticket.estado.value,
        }
        query = sql.SQL("INSERT INTO tickets ({}) VALUES ({}) RETURNING id").format(
            sql.SQL(", ").join(map(sql.Identifier, params)),
            sql.SQL(", ").join(map(sql.Placeholder, params)),
        )
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(query, params)
            row = cur.fetchone()
        assert row is not None  # noqa: S101 - INSERT ... RETURNING always returns a row
        return int(row[0])

    def list(self, filters: TicketFilters) -> TicketPage:
        q = (filters.q or "").strip()
        email_bidx = self._cipher.blind_index(q) if q and is_email_query(q) else None
        where, params = _where(filters, email_bidx)
        order = sql.SQL("ORDER BY created_at DESC, id DESC")

        with self._pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            if q and email_bidx is None:
                # Free text: decrypt the newest candidates and match in memory.
                params["scan_limit"] = self._scan_limit
                cur.execute(
                    sql.SQL("SELECT * FROM tickets {} {} LIMIT %(scan_limit)s").format(
                        where, order
                    ),
                    params,
                )
                found = [t for t in map(self._to_ticket, cur.fetchall()) if matches_text(t, q)]
                return _paginate(found, filters)

            cur.execute(sql.SQL("SELECT count(*) AS n FROM tickets {}").format(where), params)
            count_row = cur.fetchone()
            total = int(count_row["n"]) if count_row else 0
            params |= {"limit": filters.size, "offset": (filters.page - 1) * filters.size}
            cur.execute(
                sql.SQL("SELECT * FROM tickets {} {} LIMIT %(limit)s OFFSET %(offset)s").format(
                    where, order
                ),
                params,
            )
            items = [self._to_ticket(r) for r in cur.fetchall()]
        return TicketPage(items=items, total=total, page=filters.page, size=filters.size)

    def get(self, ticket_id: int) -> Ticket | None:
        with self._pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT * FROM tickets WHERE id = %s", (ticket_id,))
            row = cur.fetchone()
        return self._to_ticket(row) if row else None

    def update_estado(self, ticket_id: int, estado: Estado) -> Ticket | None:
        with self._pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "UPDATE tickets SET estado = %s WHERE id = %s RETURNING *",
                (estado.value, ticket_id),
            )
            row = cur.fetchone()
        return self._to_ticket(row) if row else None

    def stats(self) -> Stats:
        with self._pool.connection() as conn, conn.cursor() as cur:
            result: dict[str, dict[str, int]] = {}
            for column in FILTER_COLUMNS:
                query = sql.SQL("SELECT {col}, count(*) FROM tickets GROUP BY {col}").format(
                    col=sql.Identifier(column)
                )
                cur.execute(query)
                result[column] = {str(k): int(v) for k, v in cur.fetchall()}
        return Stats(
            total=sum(result["estado"].values()),
            por_categoria=result["categoria"],
            por_prioridad=result["prioridad"],
            por_estado=result["estado"],
        )


class InMemoryTicketRepository:
    """Test double with the same filtering and search semantics as the SQL version."""

    def __init__(self, tickets: list[Ticket] | None = None) -> None:
        self._tickets = {t.id: t for t in tickets or []}

    def create(self, ticket: TicketIngest) -> int:
        new_id = max(self._tickets, default=0) + 1
        now = datetime.now(UTC)
        self._tickets[new_id] = Ticket(
            id=new_id,
            created_at=now,
            updated_at=now,
            **ticket.model_dump(),
        )
        return new_id

    def list(self, filters: TicketFilters) -> TicketPage:
        q = (filters.q or "").strip()

        def matches(t: Ticket) -> bool:
            for field in FILTER_COLUMNS:
                wanted = getattr(filters, field)
                if wanted is not None and getattr(t, field) != wanted:
                    return False
            return matches_text(t, q) if q else True

        found = sorted(
            (t for t in self._tickets.values() if matches(t)),
            key=lambda t: (t.created_at, t.id),
            reverse=True,
        )
        return _paginate(found, filters)

    def get(self, ticket_id: int) -> Ticket | None:
        return self._tickets.get(ticket_id)

    def update_estado(self, ticket_id: int, estado: Estado) -> Ticket | None:
        ticket = self._tickets.get(ticket_id)
        if ticket is None:
            return None
        updated = ticket.model_copy(update={"estado": estado})
        self._tickets[ticket_id] = updated
        return updated

    def stats(self) -> Stats:
        def count(field: str) -> dict[str, int]:
            out: dict[str, int] = {}
            for t in self._tickets.values():
                key = str(getattr(t, field).value)
                out[key] = out.get(key, 0) + 1
            return out

        return Stats(
            total=len(self._tickets),
            por_categoria=count("categoria"),
            por_prioridad=count("prioridad"),
            por_estado=count("estado"),
        )
