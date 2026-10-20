import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import MessageModal from '../components/MessageModal.vue'
import type { Ticket } from '../types'

const ticket: Ticket = {
  id: 8,
  nombre: 'Ana',
  apellidos: 'Ruiz',
  email: 'ana@example.com',
  consulta: 'Línea 1\nLínea 2 <script>alert(1)</script><img src=x onerror=alert(2)>',
  categoria: 'spam',
  prioridad: 'baja',
  sentimiento: 'neutro',
  resumen: 'Resumen corto',
  confianza: '0.95',
  estado: 'descartado',
  created_at: '2026-10-20T01:46:00Z',
  updated_at: '2026-10-20T01:46:00Z',
}

describe('MessageModal', () => {
  it('shows the full original message, not the AI summary', () => {
    const wrapper = mount(MessageModal, { props: { ticket } })

    expect(wrapper.find('.mensaje').text()).toContain('Línea 1')
    expect(wrapper.text()).not.toContain('Resumen corto')
    expect(wrapper.text()).toContain('Mensaje del ticket #8')
    expect(wrapper.text()).toContain('ana@example.com')
  })

  it('renders the customer text as text, never as HTML', () => {
    const wrapper = mount(MessageModal, { props: { ticket } })

    expect(wrapper.find('.mensaje script').exists()).toBe(false)
    expect(wrapper.find('.mensaje img').exists()).toBe(false)
    expect(wrapper.find('.mensaje').text()).toContain('<script>alert(1)</script>')
  })

  it('opens as a dialog and closes from both buttons', async () => {
    const wrapper = mount(MessageModal, { props: { ticket } })

    expect(wrapper.find('dialog').attributes('open')).toBeDefined()
    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click')
    await buttons[1].trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(2)
  })

  it('closes when clicking the backdrop but not the content', async () => {
    const wrapper = mount(MessageModal, { props: { ticket } })

    await wrapper.find('.mensaje').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()
    await wrapper.find('dialog').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
