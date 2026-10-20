import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TicketTable from '../components/TicketTable.vue'
import type { Ticket, TicketPage } from '../types'

const ticket = (id: number, overrides: Partial<Ticket> = {}): Ticket => ({
  id,
  nombre: 'Ana',
  apellidos: 'Ruiz',
  email: 'ana@example.com',
  consulta: 'Necesito un presupuesto para un pentest.',
  categoria: 'presupuesto',
  prioridad: 'media',
  sentimiento: 'neutro',
  resumen: 'Presupuesto pentest',
  confianza: '0.90',
  estado: 'nuevo',
  created_at: '2026-10-01T09:00:00Z',
  updated_at: '2026-10-01T09:00:00Z',
  ...overrides,
})

const page = (items: Ticket[], total = items.length, current = 1): TicketPage => ({
  items,
  total,
  page: current,
  size: 20,
})

describe('TicketTable', () => {
  it('renders one row per ticket with translated labels', () => {
    const wrapper = mount(TicketTable, {
      props: { page: page([ticket(1), ticket(2, { prioridad: 'urgente' })]), selectedId: null },
    })

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Presupuesto')
    expect(rows[1].find('.prio-urgente').text()).toBe('Urgente')
  })

  it('renders customer text as text, not HTML', () => {
    const wrapper = mount(TicketTable, {
      props: { page: page([ticket(1, { resumen: '<img src=x onerror=alert(1)>' })]), selectedId: null },
    })

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
  })

  it('emits select on row click', async () => {
    const t = ticket(7)
    const wrapper = mount(TicketTable, { props: { page: page([t]), selectedId: null } })

    await wrapper.find('tbody tr').trigger('click')

    expect(wrapper.emitted('select')?.[0]).toEqual([t])
  })

  it('"Ver mensaje" emits view without selecting the row', async () => {
    const t = ticket(3)
    const wrapper = mount(TicketTable, { props: { page: page([t]), selectedId: null } })

    const button = wrapper.find('tbody .view-btn')
    expect(button.text()).toBe('Ver mensaje')
    await button.trigger('click')

    expect(wrapper.emitted('view')?.[0]).toEqual([t])
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('shows an empty state and disables pagination', () => {
    const wrapper = mount(TicketTable, { props: { page: page([]), selectedId: null } })

    expect(wrapper.text()).toContain('No hay tickets')
    for (const b of wrapper.findAll('.pager button')) expect(b.attributes('disabled')).toBeDefined()
  })

  it('paginates', async () => {
    const wrapper = mount(TicketTable, { props: { page: page([ticket(1)], 45, 2), selectedId: null } })

    expect(wrapper.text()).toContain('Página 2 de 3')
    const [prev, next] = wrapper.findAll('.pager button')
    await prev.trigger('click')
    await next.trigger('click')
    expect(wrapper.emitted('page')).toEqual([[1], [3]])
  })
})
