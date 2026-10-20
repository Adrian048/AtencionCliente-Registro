<script setup lang="ts">
import { computed } from 'vue'

import { CATEGORIA_LABEL } from '../labels'
import { CATEGORIAS, type Stats } from '../types'

const props = defineProps<{ stats: Stats; active: string }>()
const emit = defineEmits<{ select: [categoria: string] }>()

const pendientes = computed(
  () => (props.stats.por_estado.nuevo ?? 0) + (props.stats.por_estado.revision_manual ?? 0),
)
const max = computed(() => Math.max(1, ...Object.values(props.stats.por_categoria)))
</script>

<template>
  <section class="stats">
    <div class="card kpi">
      <span class="muted">Total</span>
      <strong>{{ stats.total }}</strong>
    </div>
    <div class="card kpi">
      <span class="muted">Pendientes</span>
      <strong>{{ pendientes }}</strong>
    </div>
    <div class="card kpi urgent">
      <span class="muted">Urgentes</span>
      <strong>{{ stats.por_prioridad.urgente ?? 0 }}</strong>
    </div>
    <div class="card kpi">
      <span class="muted">Revisión manual</span>
      <strong>{{ stats.por_estado.revision_manual ?? 0 }}</strong>
    </div>

    <div class="card categories" aria-label="Tickets por categoría">
      <button
        v-for="c in CATEGORIAS"
        :key="c"
        class="bar-row"
        :class="{ active: active === c }"
        :aria-pressed="active === c"
        @click="emit('select', c)"
      >
        <span class="bar-label">{{ CATEGORIA_LABEL[c] }}</span>
        <span class="bar-track">
          <span class="bar" :class="`cat-${c}`" :style="{ width: `${((stats.por_categoria[c] ?? 0) / max) * 100}%` }" />
        </span>
        <span class="bar-value">{{ stats.por_categoria[c] ?? 0 }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.kpi {
  display: grid;
  gap: 4px;
}
.kpi strong {
  font-size: 1.8rem;
  font-variant-numeric: tabular-nums;
}
.kpi.urgent strong {
  color: var(--danger);
}
.categories {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px 24px;
}
.bar-row {
  all: unset;
  display: grid;
  grid-template-columns: 170px 1fr 32px;
  align-items: center;
  gap: 10px;
  padding: 4px 6px;
  border-radius: 6px;
  cursor: pointer;
}
.bar-row:hover,
.bar-row.active {
  background: var(--hover);
}
.bar-row:focus-visible {
  outline: 2px solid var(--accent);
}
.bar-track {
  height: 8px;
  background: var(--hover);
  border-radius: 4px;
  overflow: hidden;
}
.bar {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: var(--cat-color);
}
.bar-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 800px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .categories {
    grid-template-columns: 1fr;
  }
  .bar-row {
    grid-template-columns: 130px 1fr 28px;
  }
}
</style>
