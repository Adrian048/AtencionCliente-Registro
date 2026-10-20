from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from triage_api.auth import CurrentUser
from triage_api.repository import TicketRepository
from triage_api.schemas import Stats, Ticket, TicketFilters, TicketPage, TicketUpdate

router = APIRouter(prefix="/api", tags=["tickets"])


def get_repository(request: Request) -> TicketRepository:
    repo: TicketRepository = request.app.state.repository
    return repo


Repo = Annotated[TicketRepository, Depends(get_repository)]


@router.get("/tickets", response_model=TicketPage)
def list_tickets(
    _: CurrentUser, repo: Repo, filters: Annotated[TicketFilters, Query()]
) -> TicketPage:
    return repo.list(filters)


@router.get("/tickets/{ticket_id}", response_model=Ticket)
def get_ticket(ticket_id: int, _: CurrentUser, repo: Repo) -> Ticket:
    ticket = repo.get(ticket_id)
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ticket not found")
    return ticket


@router.patch("/tickets/{ticket_id}", response_model=Ticket)
def update_ticket(ticket_id: int, body: TicketUpdate, _: CurrentUser, repo: Repo) -> Ticket:
    ticket = repo.update_estado(ticket_id, body.estado)
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ticket not found")
    return ticket


@router.get("/stats", response_model=Stats)
def stats(_: CurrentUser, repo: Repo) -> Stats:
    return repo.stats()
