"""Internal endpoint the n8n workflow uses to store a classified ticket.

It is the only way tickets enter the database, so encryption happens in one place
and n8n never holds database credentials or the encryption key. nginx does not
proxy ``/api/internal/``: it is reachable only from inside the compose network.
"""

import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status

from triage_api.config import Settings, get_settings
from triage_api.schemas import TicketCreated, TicketIngest
from triage_api.tickets import Repo

router = APIRouter(prefix="/api/internal", tags=["internal"])


def require_ingest_key(
    settings: Annotated[Settings, Depends(get_settings)],
    x_ingest_key: Annotated[str | None, Header()] = None,
) -> None:
    expected = settings.ingest_api_key.get_secret_value()
    if x_ingest_key is None or not secrets.compare_digest(x_ingest_key, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid ingest key")


@router.post(
    "/tickets",
    response_model=TicketCreated,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_ingest_key)],
)
def create_ticket(body: TicketIngest, repo: Repo) -> TicketCreated:
    return TicketCreated(id=repo.create(body))
