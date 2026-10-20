<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

import { LIMITS, submitContact, validate, type ContactField, type ContactInput } from './contact'

const form = reactive<ContactInput>({ nombre: '', apellidos: '', email: '', consulta: '' })
const consent = ref(false)
// Honeypot: invisible to people, bots tend to fill every field.
const website = ref('')

const touched = reactive<Record<ContactField, boolean>>({
  nombre: false,
  apellidos: false,
  email: false,
  consulta: false,
})
const attempted = ref(false)
const status = ref<'idle' | 'sending' | 'success' | 'error'>('idle')
const ticketId = ref(0)
const serverMessage = ref('')
const serverDetails = ref<string[]>([])

const errors = computed(() => validate(form))
const consentError = computed(() => (consent.value ? '' : 'Necesitamos tu consentimiento para responderte.'))

function errorFor(field: ContactField): string | undefined {
  return touched[field] || attempted.value ? errors.value[field] : undefined
}

async function onSubmit() {
  attempted.value = true
  serverMessage.value = ''
  serverDetails.value = []
  if (Object.keys(errors.value).length > 0 || consentError.value) return

  if (website.value) {
    // Pretend it worked so the bot learns nothing; nothing is sent.
    ticketId.value = 0
    status.value = 'success'
    return
  }

  status.value = 'sending'
  const result = await submitContact(form)
  if (result.ok) {
    ticketId.value = result.ticketId
    status.value = 'success'
  } else {
    serverMessage.value = result.message
    serverDetails.value = result.details
    status.value = 'error'
  }
}

function reset() {
  Object.assign(form, { nombre: '', apellidos: '', email: '', consulta: '' })
  Object.assign(touched, { nombre: false, apellidos: false, email: false, consulta: false })
  consent.value = false
  attempted.value = false
  status.value = 'idle'
}
</script>

<template>
  <div class="form-card">
    <div v-if="status === 'success'" class="success" role="status">
      <div class="success-icon" aria-hidden="true">✓</div>
      <h3>¡Consulta recibida!</h3>
      <p>
        Gracias, {{ form.nombre }}. La hemos clasificado y ya está en manos del equipo adecuado.
        Te responderemos en <strong>{{ form.email }}</strong>.
      </p>
      <p v-if="ticketId" class="reference">Referencia: <strong>#{{ ticketId }}</strong></p>
      <button type="button" class="btn btn-secondary" @click="reset">Enviar otra consulta</button>
    </div>

    <form v-else novalidate @submit.prevent="onSubmit">
      <div class="row">
        <div class="field">
          <label for="cf-nombre">Nombre</label>
          <input
            id="cf-nombre"
            v-model="form.nombre"
            autocomplete="given-name"
            :maxlength="LIMITS.nombre"
            :aria-invalid="!!errorFor('nombre')"
            aria-describedby="cf-nombre-err"
            @blur="touched.nombre = true"
          />
          <p id="cf-nombre-err" class="field-error">{{ errorFor('nombre') }}</p>
        </div>
        <div class="field">
          <label for="cf-apellidos">Apellidos</label>
          <input
            id="cf-apellidos"
            v-model="form.apellidos"
            autocomplete="family-name"
            :maxlength="LIMITS.apellidos"
            :aria-invalid="!!errorFor('apellidos')"
            aria-describedby="cf-apellidos-err"
            @blur="touched.apellidos = true"
          />
          <p id="cf-apellidos-err" class="field-error">{{ errorFor('apellidos') }}</p>
        </div>
      </div>

      <div class="field">
        <label for="cf-email">Email</label>
        <input
          id="cf-email"
          v-model="form.email"
          type="email"
          autocomplete="email"
          inputmode="email"
          :maxlength="LIMITS.email"
          :aria-invalid="!!errorFor('email')"
          aria-describedby="cf-email-err"
          @blur="touched.email = true"
        />
        <p id="cf-email-err" class="field-error">{{ errorFor('email') }}</p>
      </div>

      <div class="field">
        <label for="cf-consulta">¿En qué podemos ayudarte?</label>
        <textarea
          id="cf-consulta"
          v-model="form.consulta"
          rows="6"
          :maxlength="LIMITS.consulta"
          placeholder="Cuéntanos tu caso: qué necesitas, plazos, si hay algo urgente…"
          :aria-invalid="!!errorFor('consulta')"
          aria-describedby="cf-consulta-err cf-consulta-count"
          @blur="touched.consulta = true"
        />
        <div class="field-meta">
          <p id="cf-consulta-err" class="field-error">{{ errorFor('consulta') }}</p>
          <span id="cf-consulta-count" class="counter">{{ form.consulta.length }} / {{ LIMITS.consulta }}</span>
        </div>
      </div>

      <!-- Honeypot field, hidden from people and assistive technology -->
      <div class="hp" aria-hidden="true">
        <label for="cf-website">Web</label>
        <input id="cf-website" v-model="website" tabindex="-1" autocomplete="off" />
      </div>

      <div class="field">
        <label class="check">
          <input v-model="consent" type="checkbox" />
          <span>
            Acepto que se traten mis datos para responder a esta consulta. Se guardan cifrados y la
            IA solo lee el texto de la consulta, nunca tu nombre ni tu email.
          </span>
        </label>
        <p class="field-error">{{ attempted ? consentError : '' }}</p>
      </div>

      <div v-if="status === 'error'" class="alert" role="alert">
        <p>{{ serverMessage }}</p>
        <ul v-if="serverDetails.length">
          <li v-for="d in serverDetails" :key="d">{{ d }}</li>
        </ul>
      </div>

      <button type="submit" class="btn btn-primary btn-block" :disabled="status === 'sending'">
        {{ status === 'sending' ? 'Enviando…' : 'Enviar consulta' }}
      </button>
    </form>
  </div>
</template>
