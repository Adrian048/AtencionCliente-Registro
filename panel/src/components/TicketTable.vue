<script setup lang="ts">
import { computed } from 'vue'

import { CATEGORIA_LABEL, ESTADO_LABEL, formatDate, PRIORIDAD_LABEL } from '../labels'
import type { Ticket, TicketPage } from '../types'

const props = defineProps<{ page: TicketPage; selectedId: number | null }>()
const emit = defineEmits<{ select: [ticket: Ticket]; view: [ticket: Ticket]; page: [page: number] }>()

const pages = computed(() => Math.max(1, Math.ceil(props.page.total / props.page.size)))
</script>

<template>
  <section class="card table-card">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Fecha</th>
          <th>Cliente</th>
          <th>Resumen</th>
          <th>Categoría</th>
          <th>Prioridad</th>
          <th>Estado</th>
          <th><span class="visually-hidden">Mensaje</span></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="t in page.items"
          :key="t.id"
          :class="{ selected: t.id === selectedId }"
          tabindex="0"
          @click="emit('select', t)"
          @keydown.enter="emit('select', t)"
        >
          <td class="muted">{{ t.id }}</td>
          <td class="nowrap">{{ formatDate(t.created_at) }}</td>
          <td>
            <div>{{ t.nombre }} {{ t.apellidos }}</div>
            <div class="muted small">{{ t.email }}</div>
          </td>
          <td class="summary">{{ t.resumen ?? t.consulta }}</td>
          <td><span class="badge" :class="`cat-${t.categoria}`">{{ CATEGORIA_LABEL[t.categoria] }}</span></td>
          <td><span class="badge" :class="`prio-${t.prioridad}`">{{ PRIORIDAD_LABEL[t.prioridad] }}</span></td>
          <td class="nowrap">{{ ESTADO_LABEL[t.estado] }}</td>
          <td>
            <!-- .stop: opening the message must not also select the row -->
            <button
              class="ghost view-btn"
              :aria-label="`Ver mensaje del ticket ${t.id}`"
              @click.stop="emit('view', t)"
              @keydown.enter.stop
            >
              Ver mensaje
            </button>
          </td>
        </tr>
        <tr v-if="page.items.length === 0">
          <td colspan="8" class="empty muted">No hay tickets con estos filtros.</td>
        </tr>
      </tbody>
    </table>

    <footer class="pager">
      <span class="muted">{{ page.total }} tickets</span>
      <div>
        <button class="ghost" :disabled="page.page <= 1" @click="emit('page', page.page - 1)">‹ Anterior</button>
        <span class="muted">Página {{ page.page }} de {{ pages }}</span>
        <button class="ghost" :disabled="page.page >= pages" @click="emit('page', page.page + 1)">Siguiente ›</button>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.table-card {
  padding: 0;
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
th {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
tbody tr {
  cursor: pointer;
}
tbody tr:hover,
tbody tr.selected {
  background: var(--hover);
}
tbody tr:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.summary {
  max-width: 360px;
}
.view-btn {
  white-space: nowrap;
  font-size: 0.85rem;
  padding: 5px 10px;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
.nowrap {
  white-space: nowrap;
}
.small {
  font-size: 0.85rem;
}
.empty {
  text-align: center;
  padding: 32px;
}
.pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  gap: 12px;
}
.pager div {
  display: flex;
  gap: 10px;
  align-items: center;
}
</style>
