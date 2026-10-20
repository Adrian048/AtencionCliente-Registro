import { toQuery } from './labels'
import type { Estado, Stats, Ticket, TicketFilters, TicketPage } from './types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
  if (!response.ok) {
    let detail = response.statusText
    try {
      const body = (await response.json()) as { detail?: unknown }
      if (typeof body.detail === 'string') detail = body.detail
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(response.status, detail)
  }
  return (response.status === 204 ? undefined : await response.json()) as T
}

export const api = {
  me: () => request<{ username: string }>('/auth/me'),
  login: (username: string, password: string) =>
    request<{ username: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  listTickets: (filters: TicketFilters) => request<TicketPage>(`/tickets${toQuery(filters)}`),
  updateEstado: (id: number, estado: Estado) =>
    request<Ticket>(`/tickets/${id}`, { method: 'PATCH', body: JSON.stringify({ estado }) }),
  stats: () => request<Stats>('/stats'),
}
