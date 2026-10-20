<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { api } from './api'
import DashboardView from './views/DashboardView.vue'
import LoginView from './views/LoginView.vue'

const user = ref<string | null>(null)
const checking = ref(true)

onMounted(async () => {
  try {
    user.value = (await api.me()).username
  } catch {
    user.value = null
  } finally {
    checking.value = false
  }
})

async function logout() {
  await api.logout()
  user.value = null
}
</script>

<template>
  <div v-if="checking" class="center muted">Cargando…</div>
  <LoginView v-else-if="!user" @logged-in="user = $event" />
  <DashboardView v-else :user="user" @logout="logout" @unauthorized="user = null" />
</template>
