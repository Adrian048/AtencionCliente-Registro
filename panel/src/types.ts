// Mirrors api/src/triage_api/schemas.py

export const CATEGORIAS = [
  'presupuesto',
  'ciberseguridad',
  'desarrollo_a_medida',
  'inteligencia_artificial',
  'mantenimiento',
  'incidencia',
  'consulta_general',
  'spam',
] as const
export const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'] as const
export const ESTADOS = ['nuevo', 'revision_manual', 'en_curso', 'resuelto', 'descartado'] as const

export type Categoria = (typeof CATEGORIAS)[number]
export type Prioridad = (typeof PRIORIDADES)[number]
export type Estado = (typeof ESTADOS)[number]

export interface Ticket {
  id: number
  nombre: string
  apellidos: string
  email: string
  consulta: string
  categoria: Categoria
  prioridad: Prioridad
  sentimiento: 'positivo' | 'neutro' | 'negativo' | null
  resumen: string | null
  confianza: string | null // Decimal serialised as string
  estado: Estado
  created_at: string
  updated_at: string
}

export interface TicketPage {
  items: Ticket[]
  total: number
  page: number
  size: number
}

export interface TicketFilters {
  categoria?: Categoria | ''
  prioridad?: Prioridad | ''
  estado?: Estado | ''
  q?: string
  page?: number
  size?: number
}

export interface Stats {
  total: number
  por_categoria: Partial<Record<Categoria, number>>
  por_prioridad: Partial<Record<Prioridad, number>>
  por_estado: Partial<Record<Estado, number>>
}
