// Madrid time and on-call shift: the live part of the landing.
//
// Pure functions (the date is injectable) so the shift rules can be unit tested.

export interface MadridTime {
  h: number
  m: number
  hhmm: string
  weekend: boolean
}

export function madridTime(date: Date = new Date()): MadridTime {
  const parts = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  const h = Number(get('hour')) % 24
  const m = Number(get('minute'))
  return {
    h,
    m,
    hhmm: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    weekend: /sáb|dom/i.test(get('weekday')),
  }
}

// Office hours: Monday to Friday, 9:00 to 18:00 (Madrid). Everything else is the on-call shift.
export function isOfficeHours(t: Pick<MadridTime, 'h' | 'weekend'>): boolean {
  return !t.weekend && t.h >= 9 && t.h < 18
}

export type Severity = 'caida' | 'degradado' | 'consulta'

export const SEVERITIES: Record<Severity, { title: string; text: string }> = {
  caida: {
    title: 'Respuesta en 15 minutos',
    text: 'Tu servicio no responde. A cualquier hora, un ingeniero de guardia entra en tus sistemas, restablece el servicio y te deja un parte de lo ocurrido.',
  },
  degradado: {
    title: 'Respuesta en una hora',
    text: 'Funciona, pero mal: lentitud, errores intermitentes o una alerta de seguridad. Lo diagnosticamos y lo dejamos estable sin parar tu negocio.',
  },
  consulta: {
    title: 'Respuesta el mismo día',
    text: 'Una duda, un acceso nuevo o un cambio pequeño. Te responde alguien que ya conoce tu sistema, sin tickets que viajan de mesa en mesa.',
  },
}

// Who answers right now, per severity (short label for the table).
export function whoAnswers(severity: Severity, t: Pick<MadridTime, 'h' | 'weekend'>): string {
  const office = isOfficeHours(t)
  if (severity === 'consulta') return office ? 'Hoy' : 'Próximo día laborable'
  return office ? 'Equipo' : 'Guardia'
}

// Sentence under the tabs. Plain text; the caller decides how to highlight the time.
export function nowSentence(severity: Severity, t: MadridTime): string {
  const office = isOfficeHours(t)
  const prefix = `Ahora son las ${t.hhmm}: `
  switch (severity) {
    case 'caida':
      return prefix + (office ? 'te atiende el equipo completo y en 15 minutos hay alguien dentro.' : 'te atiende la guardia, también en 15 minutos.')
    case 'degradado':
      return prefix + (office ? 'lo revisa quien conoce tu sistema, antes de una hora.' : 'la guardia lo diagnostica en menos de una hora.')
    case 'consulta':
      return prefix + (office ? 'te respondemos hoy.' : 'te respondemos el próximo día laborable antes de las 10:00.')
  }
}
