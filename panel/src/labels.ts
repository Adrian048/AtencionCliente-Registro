import type { Categoria, Estado, Prioridad, TicketFilters } from './types'

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  presupuesto: 'Presupuesto',
  ciberseguridad: 'Ciberseguridad',
  desarrollo_a_medida: 'Desarrollo a medida',
  inteligencia_artificial: 'Inteligencia artificial',
  mantenimiento: 'Mantenimiento',
  incidencia: 'Incidencia',
  consulta_general: 'Consulta general',
  spam: 'Spam',
}

export const PRIORIDAD_LABEL: Record<Prioridad, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
}

export const ESTADO_LABEL: Record<Estado, string> = {
  nuevo: 'Nuevo',
  revision_manual: 'Revisión manual',
  en_curso: 'En curso',
  resuelto: 'Resuelto',
  descartado: 'Descartado',
}

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
})

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

/** "0.87" -> "87 %"; null -> "—" */
export function formatConfidence(value: string | null): string {
  if (value === null) return '—'
  const n = Number(value)
  return Number.isFinite(n) ? `${Math.round(n * 100)} %` : '—'
}

/** Builds a query string, dropping empty filters. */
export function toQuery(filters: TicketFilters): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}
