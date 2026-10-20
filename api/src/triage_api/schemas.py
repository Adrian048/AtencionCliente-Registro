"""API models. The enums mirror the CHECK constraints in db/init/01_schema.sql."""

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Categoria(StrEnum):
    PRESUPUESTO = "presupuesto"
    CIBERSEGURIDAD = "ciberseguridad"
    DESARROLLO_A_MEDIDA = "desarrollo_a_medida"
    INTELIGENCIA_ARTIFICIAL = "inteligencia_artificial"
    MANTENIMIENTO = "mantenimiento"
    INCIDENCIA = "incidencia"
    CONSULTA_GENERAL = "consulta_general"
    SPAM = "spam"


class Prioridad(StrEnum):
    BAJA = "baja"
    MEDIA = "media"
    ALTA = "alta"
    URGENTE = "urgente"


class Estado(StrEnum):
    NUEVO = "nuevo"
    REVISION_MANUAL = "revision_manual"
    EN_CURSO = "en_curso"
    RESUELTO = "resuelto"
    DESCARTADO = "descartado"


class Ticket(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    apellidos: str
    email: str
    consulta: str
    categoria: Categoria
    prioridad: Prioridad
    sentimiento: str | None
    resumen: str | None
    confianza: Decimal | None
    estado: Estado
    created_at: datetime
    updated_at: datetime


class Sentimiento(StrEnum):
    POSITIVO = "positivo"
    NEUTRO = "neutro"
    NEGATIVO = "negativo"


EMAIL_PATTERN = r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$"


class TicketIngest(BaseModel):
    """Ticket submitted by the n8n workflow after AI classification.

    The workflow already validates, but the API validates again: it is the only
    component that writes to the database, so it is the trust boundary.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    nombre: str = Field(min_length=1, max_length=100)
    apellidos: str = Field(min_length=1, max_length=150)
    email: str = Field(max_length=254, pattern=EMAIL_PATTERN)
    consulta: str = Field(min_length=10, max_length=4000)
    categoria: Categoria
    prioridad: Prioridad
    sentimiento: Sentimiento | None = None
    resumen: str | None = Field(default=None, max_length=300)
    confianza: Decimal | None = Field(default=None, ge=0, le=1, decimal_places=2)
    # A new ticket can only start in one of these states
    estado: Literal[Estado.NUEVO, Estado.REVISION_MANUAL, Estado.DESCARTADO] = Estado.NUEVO


class TicketCreated(BaseModel):
    id: int


class TicketFilters(BaseModel):
    categoria: Categoria | None = None
    prioridad: Prioridad | None = None
    estado: Estado | None = None
    q: str | None = Field(default=None, max_length=100)
    page: int = Field(default=1, ge=1)
    size: int = Field(default=20, ge=1, le=100)


class TicketPage(BaseModel):
    items: list[Ticket]
    total: int
    page: int
    size: int


class TicketUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")  # only the state can be changed

    estado: Estado


class Stats(BaseModel):
    total: int
    por_categoria: dict[str, int]
    por_prioridad: dict[str, int]
    por_estado: dict[str, int]


class LoginRequest(BaseModel):
    username: str = Field(max_length=100)
    password: str = Field(max_length=200)


class Me(BaseModel):
    username: str
