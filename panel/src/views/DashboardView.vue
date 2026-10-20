<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'

import { api, ApiError } from '../api'
import MessageModal from '../components/MessageModal.vue'
import StatsCards from '../components/StatsCards.vue'
import TicketDetail from '../components/TicketDetail.vue'
import TicketTable from '../components/TicketTable.vue'
import { CATEGORIA_LABEL, ESTADO_LABEL, PRIORIDAD_LABEL } from '../labels'
import {
  CATEGORIAS,
  ESTADOS,
  PRIORIDADES,
  type Estado,
  type Stats,
  type Ticket,
  type TicketFilters,
  type TicketPage,
} from '../types'

defineProps<{ user: string }>()
const emit = defineEmits<{ logout: []; unauthorized: [] }>()

const filters = reactive<TicketFilters>({ categoria: '', prioridad: '', estado: '', q: '', page: 1, size: 20 })
const page = ref<TicketPage | null>(null)
const stats = ref<Stats | null>(null)
const selected = ref<Ticket | null>(null)
const viewing = ref<Ticket | null>(null)
const error = ref('')

async function guarded<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    error.value = ''
    return await fn()
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) emit('unauthorized')
    else error.value = 'No se pudieron cargar los datos.'
    return undefined
  }
}

async function load() {
  const [p, s] = await Promise.all([
    guarded(() => api.listTickets(filters)),
    guarded(() => api.stats()),
  ])
  if (p) page.value = p
  if (s) stats.value = s
}

async function changeEstado(ticket: Ticket, estado: Estado) {
  const updated = await guarded(() => api.updateEstado(ticket.id, estado))
  if (updated) {
    selected.value = updated
    await load()
  }
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => [filters.categoria, filters.prioridad, filters.estado],
  () => {
    filters.page = 1
    load()
  },
)
watch(
  () => filters.q,
  () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      filters.page = 1
      load()
    }, 300)
  },
)

function goTo(p: number) {
  filters.page = p
  load()
}

function filterByCategoria(categoria: string) {
  filters.categoria = filters.categoria === categoria ? '' : (categoria as TicketFilters['categoria'])
}

onMounted(load)
</script>

<template>
  <header class="topbar">
    <div>
      <strong>Panel de soporte</strong>
      <span class="muted"> · triage con IA</span>
    </div>
    <div class="topbar-user">
      <span class="muted">{{ user }}</span>
      <button class="ghost" @click="emit('logout')">Salir</button>
    </div>
  </header>

  <main class="layout">
    <StatsCards v-if="stats" :stats="stats" :active="filters.categoria ?? ''" @select="filterByCategoria" />

    <section class="card filters" aria-label="Filtros">
      <input v-model="filters.q" type="search" placeholder="Buscar por nombre, email o texto…" maxlength="100" />
      <select v-model="filters.categoria" aria-label="Categoría">
        <option value="">Todas las categorías</option>
        <option v-for="c in CATEGORIAS" :key="c" :value="c">{{ CATEGORIA_LABEL[c] }}</option>
      </select>
      <select v-model="filters.prioridad" aria-label="Prioridad">
        <option value="">Todas las prioridades</option>
        <option v-for="p in PRIORIDADES" :key="p" :value="p">{{ PRIORIDAD_LABEL[p] }}</option>
      </select>
      <select v-model="filters.estado" aria-label="Estado">
        <option value="">Todos los estados</option>
        <option v-for="e in ESTADOS" :key="e" :value="e">{{ ESTADO_LABEL[e] }}</option>
      </select>
    </section>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <TicketTable v-if="page" :page="page" :selected-id="selected?.id ?? null" @select="selected = $event" @view="viewing = $event" @page="goTo" />
  </main>

  <MessageModal v-if="viewing" :ticket="viewing" @close="viewing = null" />
  <TicketDetail v-if="selected" :ticket="selected" @close="selected = null" @change-estado="changeEstado" />
</template>

<style scoped>
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 24px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.topbar-user {
  display: flex;
  gap: 12px;
  align-items: center;
}
.layout {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  display: grid;
  gap: 16px;
}
.filters {
  display: grid;
  grid-template-columns: 2fr repeat(3, 1fr);
  gap: 10px;
}
@media (max-width: 800px) {
  .filters {
    grid-template-columns: 1fr;
  }
  .layout {
    padding: 16px;
  }
}
</style>
