import { describe, expect, it, vi } from 'vitest'

import { ENDPOINT, normalise, submitContact, validate, type ContactInput } from '../landing/contact'

const valid: ContactInput = {
  nombre: ' Ana ',
  apellidos: 'Ruiz Sanz',
  email: ' Ana@Example.COM ',
  consulta: 'Queremos un presupuesto para un pentest.',
}

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('validate', () => {
  it('accepts a valid form', () => {
    expect(validate(valid)).toEqual({})
  })

  it('requires every field', () => {
    const errors = validate({ nombre: ' ', apellidos: '', email: '', consulta: '' })
    expect(Object.keys(errors).sort()).toEqual(['apellidos', 'consulta', 'email', 'nombre'])
  })

  it('checks email format, minimum and maximum lengths', () => {
    expect(validate({ ...valid, email: 'sin-arroba.com' }).email).toBeTruthy()
    expect(validate({ ...valid, consulta: 'corta' }).consulta).toContain('10')
    expect(validate({ ...valid, consulta: 'x'.repeat(4001) }).consulta).toContain('4000')
    expect(validate({ ...valid, nombre: 'x'.repeat(101) }).nombre).toContain('100')
  })
})

describe('normalise', () => {
  it('trims fields and lowercases the email', () => {
    expect(normalise(valid)).toEqual({
      nombre: 'Ana',
      apellidos: 'Ruiz Sanz',
      email: 'ana@example.com',
      consulta: 'Queremos un presupuesto para un pentest.',
    })
  })
})

describe('submitContact', () => {
  it('posts only the four fields to the public endpoint, without any key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { ok: true, ticket_id: 42 }))

    const result = await submitContact(valid, fetchMock)

    expect(result).toEqual({ ok: true, ticketId: 42 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(ENDPOINT)
    expect(Object.keys(JSON.parse(init.body)).sort()).toEqual(['apellidos', 'consulta', 'email', 'nombre'])
    expect(JSON.stringify(init.headers).toLowerCase()).not.toContain('api-key')
  })

  it('maps server validation errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(400, { ok: false, errores: ['email: formato no válido'] }))

    const result = await submitContact(valid, fetchMock)

    expect(result).toMatchObject({ ok: false, kind: 'validation', details: ['email: formato no válido'] })
  })

  it('maps rate limiting, server and network errors', async () => {
    expect(await submitContact(valid, vi.fn().mockResolvedValue(new Response('', { status: 429 })))).toMatchObject({
      kind: 'rate_limit',
    })
    expect(await submitContact(valid, vi.fn().mockResolvedValue(new Response('', { status: 500 })))).toMatchObject({
      kind: 'server',
    })
    expect(await submitContact(valid, vi.fn().mockRejectedValue(new TypeError('offline')))).toMatchObject({
      kind: 'network',
    })
  })
})
