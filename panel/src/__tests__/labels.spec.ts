import { describe, expect, it } from 'vitest'

import { CATEGORIA_LABEL, ESTADO_LABEL, formatConfidence, PRIORIDAD_LABEL, toQuery } from '../labels'
import { CATEGORIAS, ESTADOS, PRIORIDADES } from '../types'

describe('labels', () => {
  it('has a label for every enum value', () => {
    for (const c of CATEGORIAS) expect(CATEGORIA_LABEL[c]).toBeTruthy()
    for (const p of PRIORIDADES) expect(PRIORIDAD_LABEL[p]).toBeTruthy()
    for (const e of ESTADOS) expect(ESTADO_LABEL[e]).toBeTruthy()
  })
})

describe('formatConfidence', () => {
  it('formats decimals as percentages', () => {
    expect(formatConfidence('0.87')).toBe('87 %')
    expect(formatConfidence('1')).toBe('100 %')
  })

  it('handles missing or invalid values', () => {
    expect(formatConfidence(null)).toBe('—')
    expect(formatConfidence('abc')).toBe('—')
  })
})

describe('toQuery', () => {
  it('drops empty filters and encodes values', () => {
    expect(toQuery({ categoria: '', prioridad: 'alta', q: 'a&b=c', page: 2 })).toBe(
      '?prioridad=alta&q=a%26b%3Dc&page=2',
    )
  })

  it('returns an empty string when nothing is set', () => {
    expect(toQuery({ categoria: '', q: '' })).toBe('')
  })
})
