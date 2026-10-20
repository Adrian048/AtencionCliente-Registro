// Public contact form: client-side validation and submission.
//
// The rules mirror the n8n "Validar entrada" node and the API's TicketIngest model.
// Validating here is only for a better UX; the server validates again and is the
// one that decides.
//
// The browser never holds the webhook key: it posts to /api/public/contacto and
// nginx adds the key server-side before forwarding to n8n.

export interface ContactInput {
  nombre: string
  apellidos: string
  email: string
  consulta: string
}

export type ContactField = keyof ContactInput
export type ContactErrors = Partial<Record<ContactField, string>>

export const LIMITS: Record<ContactField, number> = {
  nombre: 100,
  apellidos: 150,
  email: 254,
  consulta: 4000,
}
export const MIN_CONSULTA = 10
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const ENDPOINT = '/api/public/contacto'

export function normalise(input: ContactInput): ContactInput {
  return {
    nombre: input.nombre.trim(),
    apellidos: input.apellidos.trim(),
    email: input.email.trim().toLowerCase(),
    consulta: input.consulta.trim(),
  }
}

export function validate(raw: ContactInput): ContactErrors {
  const input = normalise(raw)
  const errors: ContactErrors = {}

  if (!input.nombre) errors.nombre = 'Indica tu nombre.'
  else if (input.nombre.length > LIMITS.nombre) errors.nombre = `Máximo ${LIMITS.nombre} caracteres.`

  if (!input.apellidos) errors.apellidos = 'Indica tus apellidos.'
  else if (input.apellidos.length > LIMITS.apellidos)
    errors.apellidos = `Máximo ${LIMITS.apellidos} caracteres.`

  if (!input.email) errors.email = 'Indica tu email.'
  else if (input.email.length > LIMITS.email || !EMAIL_RE.test(input.email))
    errors.email = 'Escribe un email válido, por ejemplo nombre@empresa.com.'

  if (!input.consulta) errors.consulta = 'Cuéntanos en qué podemos ayudarte.'
  else if (input.consulta.length < MIN_CONSULTA)
    errors.consulta = `Escribe al menos ${MIN_CONSULTA} caracteres.`
  else if (input.consulta.length > LIMITS.consulta)
    errors.consulta = `Máximo ${LIMITS.consulta} caracteres.`

  return errors
}

export type SubmitResult =
  | { ok: true; ticketId: number }
  | { ok: false; kind: 'validation' | 'rate_limit' | 'server' | 'network'; message: string; details: string[] }

export async function submitContact(raw: ContactInput, fetchImpl: typeof fetch = fetch): Promise<SubmitResult> {
  let response: Response
  try {
    response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Only the four expected fields: the server rejects anything else.
      body: JSON.stringify(normalise(raw)),
    })
  } catch {
    return {
      ok: false,
      kind: 'network',
      message: 'No hemos podido conectar. Comprueba tu conexión e inténtalo de nuevo.',
      details: [],
    }
  }

  if (response.ok) {
    const body = (await response.json().catch(() => ({}))) as { ticket_id?: unknown }
    return { ok: true, ticketId: typeof body.ticket_id === 'number' ? body.ticket_id : 0 }
  }
  if (response.status === 400) {
    const body = (await response.json().catch(() => ({}))) as { errores?: unknown }
    const details = Array.isArray(body.errores) ? body.errores.filter((e): e is string => typeof e === 'string') : []
    return { ok: false, kind: 'validation', message: 'Revisa los datos del formulario.', details }
  }
  if (response.status === 429) {
    return {
      ok: false,
      kind: 'rate_limit',
      message: 'Has enviado varias consultas seguidas. Espera un minuto y vuelve a intentarlo.',
      details: [],
    }
  }
  return {
    ok: false,
    kind: 'server',
    message: 'No hemos podido registrar tu consulta. Inténtalo de nuevo en unos minutos.',
    details: [],
  }
}
