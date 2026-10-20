<script setup lang="ts">
import { CATEGORIA_LABEL, ESTADO_LABEL, formatConfidence, formatDate, PRIORIDAD_LABEL } from '../labels'
import { ESTADOS, type Estado, type Ticket } from '../types'

defineProps<{ ticket: Ticket }>()
const emit = defineEmits<{ close: []; 'change-estado': [ticket: Ticket, estado: Estado] }>()
</script>

<template>
  <aside class="drawer" role="dialog" aria-modal="false" :aria-label="`Ticket ${ticket.id}`">
    <header>
      <h2>Ticket #{{ ticket.id }}</h2>
      <button class="ghost" aria-label="Cerrar" @click="emit('close')">✕</button>
    </header>

    <dl>
      <dt>Cliente</dt>
      <dd>{{ ticket.nombre }} {{ ticket.apellidos }}</dd>
      <dt>Email</dt>
      <dd>{{ ticket.email }}</dd>
      <dt>Recibido</dt>
      <dd>{{ formatDate(ticket.created_at) }}</dd>
    </dl>

    <h3>Consulta</h3>
    <!-- Rendered as text (never v-html): the content comes from an untrusted public form. -->
    <p class="consulta">{{ ticket.consulta }}</p>

    <h3>Clasificación IA</h3>
    <dl>
      <dt>Categoría</dt>
      <dd><span class="badge" :class="`cat-${ticket.categoria}`">{{ CATEGORIA_LABEL[ticket.categoria] }}</span></dd>
      <dt>Prioridad</dt>
      <dd><span class="badge" :class="`prio-${ticket.prioridad}`">{{ PRIORIDAD_LABEL[ticket.prioridad] }}</span></dd>
      <dt>Sentimiento</dt>
      <dd>{{ ticket.sentimiento ?? '—' }}</dd>
      <dt>Confianza</dt>
      <dd>{{ formatConfidence(ticket.confianza) }}</dd>
      <dt>Resumen</dt>
      <dd>{{ ticket.resumen ?? '—' }}</dd>
    </dl>

    <h3>Estado</h3>
    <div class="estados">
      <button
        v-for="e in ESTADOS"
        :key="e"
        :class="{ ghost: e !== ticket.estado }"
        :aria-pressed="e === ticket.estado"
        @click="e !== ticket.estado && emit('change-estado', ticket, e)"
      >
        {{ ESTADO_LABEL[e] }}
      </button>
    </div>
  </aside>
</template>

<style scoped>
.drawer {
  position: fixed;
  inset: 0 0 0 auto;
  width: min(440px, 100%);
  background: var(--surface);
  border-left: 1px solid var(--border);
  box-shadow: -8px 0 24px rgb(0 0 0 / 0.12);
  padding: 20px 24px;
  overflow-y: auto;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
h2 {
  margin: 0;
  font-size: 1.2rem;
}
h3 {
  margin: 20px 0 8px;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--muted);
}
dl {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 6px 12px;
  margin: 0;
}
dt {
  color: var(--muted);
}
dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.consulta {
  white-space: pre-wrap;
  background: var(--hover);
  padding: 12px;
  border-radius: 8px;
  margin: 0;
}
.estados {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
