<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { formatDate } from '../labels'
import type { Ticket } from '../types'

defineProps<{ ticket: Ticket }>()
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)

onMounted(() => {
  // Native modal: Esc to close, focus kept inside, background inert.
  const el = dialog.value
  if (el && typeof el.showModal === 'function') el.showModal()
  else el?.setAttribute('open', '')
})

function onBackdropClick(event: MouseEvent) {
  // A click on the <dialog> itself (not its content) means the backdrop was clicked.
  if (event.target === dialog.value) emit('close')
}
</script>

<template>
  <dialog
    ref="dialog"
    class="modal"
    :aria-labelledby="`msg-title-${ticket.id}`"
    @close="emit('close')"
    @click="onBackdropClick"
  >
    <article class="modal-body">
      <header>
        <div>
          <h2 :id="`msg-title-${ticket.id}`">Mensaje del ticket #{{ ticket.id }}</h2>
          <p class="muted">
            {{ ticket.nombre }} {{ ticket.apellidos }} · {{ ticket.email }} · {{ formatDate(ticket.created_at) }}
          </p>
        </div>
        <button class="ghost" aria-label="Cerrar" @click="emit('close')">✕</button>
      </header>

      <!-- Exactly what the customer typed. Rendered as text (never v-html):
           it comes from an untrusted public form. -->
      <p class="mensaje">{{ ticket.consulta }}</p>

      <footer>
        <button @click="emit('close')">Cerrar</button>
      </footer>
    </article>
  </dialog>
</template>

<style scoped>
.modal {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0;
  width: min(640px, calc(100% - 32px));
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 20px 50px rgb(0 0 0 / 0.35);
}
.modal::backdrop {
  background: rgb(0 0 0 / 0.55);
}
.modal-body {
  padding: 20px 24px;
  display: grid;
  gap: 16px;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
h2 {
  margin: 0 0 4px;
  font-size: 1.15rem;
}
header p {
  margin: 0;
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}
.mensaje {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--hover);
  border-radius: 8px;
  padding: 14px 16px;
  max-height: 60vh;
  overflow-y: auto;
  line-height: 1.55;
}
footer {
  display: flex;
  justify-content: flex-end;
}
</style>
