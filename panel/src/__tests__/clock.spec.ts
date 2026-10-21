import { describe, expect, it } from 'vitest'

import { isOfficeHours, madridTime, nowSentence, whoAnswers } from '../landing/clock'

describe('madridTime', () => {
  it('converts UTC to Madrid time (summer, UTC+2)', () => {
    const t = madridTime(new Date('2026-07-15T22:05:00Z')) // Wednesday
    expect(t.hhmm).toBe('00:05')
    expect(t.weekend).toBe(false)
  })

  it('converts UTC to Madrid time (winter, UTC+1) and detects weekends', () => {
    const t = madridTime(new Date('2026-01-17T10:30:00Z')) // Saturday
    expect(t.hhmm).toBe('11:30')
    expect(t.weekend).toBe(true)
  })
})

describe('isOfficeHours', () => {
  it('is office time on weekdays from 9:00 to 17:59', () => {
    expect(isOfficeHours({ h: 9, weekend: false })).toBe(true)
    expect(isOfficeHours({ h: 17, weekend: false })).toBe(true)
  })

  it('is on-call time at night and at weekends', () => {
    expect(isOfficeHours({ h: 8, weekend: false })).toBe(false)
    expect(isOfficeHours({ h: 18, weekend: false })).toBe(false)
    expect(isOfficeHours({ h: 11, weekend: true })).toBe(false)
  })
})

describe('whoAnswers and nowSentence', () => {
  const night = { h: 3, m: 14, hhmm: '03:14', weekend: false }
  const day = { h: 11, m: 0, hhmm: '11:00', weekend: false }

  it('sends outages to the on-call shift at night', () => {
    expect(whoAnswers('caida', night)).toBe('Guardia')
    expect(nowSentence('caida', night)).toContain('03:14')
    expect(nowSentence('caida', night)).toContain('guardia')
  })

  it('answers questions the same day only in office hours', () => {
    expect(whoAnswers('consulta', day)).toBe('Hoy')
    expect(whoAnswers('consulta', night)).toBe('Próximo día laborable')
  })
})
