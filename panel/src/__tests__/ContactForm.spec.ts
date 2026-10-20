import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ContactForm from '../landing/ContactForm.vue'

async function fill(wrapper: VueWrapper, { consent = true } = {}) {
  await wrapper.find('#cf-nombre').setValue('Ana')
  await wrapper.find('#cf-apellidos').setValue('Ruiz')
  await wrapper.find('#cf-email').setValue('ana@example.com')
  await wrapper.find('#cf-consulta').setValue('Necesitamos una auditoría de seguridad.')
  if (consent) await wrapper.find('input[type="checkbox"]').setValue(true)
}

afterEach(() => vi.unstubAllGlobals())

describe('ContactForm', () => {
  it('shows field errors and sends nothing when the form is empty', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(ContactForm)

    await wrapper.find('form').trigger('submit')

    expect(wrapper.find('#cf-email-err').text()).toBeTruthy()
    expect(wrapper.find('#cf-consulta-err').text()).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('requires consent', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(ContactForm)

    await fill(wrapper, { consent: false })
    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('consentimiento')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('submits and shows the ticket reference', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, ticket_id: 12 }), { status: 201 })),
    )
    const wrapper = mount(ContactForm)

    await fill(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="status"]').text()).toContain('#12')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('shows the server error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })))
    const wrapper = mount(ContactForm)

    await fill(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('Espera un minuto')
  })

  it('honeypot: pretends success but never sends anything', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(ContactForm)

    await fill(wrapper)
    await wrapper.find('#cf-website').setValue('http://spam.example')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })
})
