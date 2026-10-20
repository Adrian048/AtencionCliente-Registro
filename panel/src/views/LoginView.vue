<script setup lang="ts">
import { ref } from 'vue'

import { api, ApiError } from '../api'

const emit = defineEmits<{ 'logged-in': [username: string] }>()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const me = await api.login(username.value, password.value)
    emit('logged-in', me.username)
  } catch (e) {
    error.value =
      e instanceof ApiError && e.status === 429
        ? 'Demasiados intentos. Espera unos minutos.'
        : 'Usuario o contraseña incorrectos.'
  } finally {
    password.value = ''
    loading.value = false
  }
}
</script>

<template>
  <main class="center">
    <form class="card login" @submit.prevent="submit">
      <h1>Panel de soporte</h1>
      <p class="muted">Consultas clasificadas automáticamente con IA</p>
      <label>
        Usuario
        <input v-model="username" autocomplete="username" required />
      </label>
      <label>
        Contraseña
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button type="submit" :disabled="loading">{{ loading ? 'Entrando…' : 'Entrar' }}</button>
    </form>
  </main>
</template>

<style scoped>
.login {
  width: min(360px, 100%);
  display: grid;
  gap: 14px;
}
.login h1 {
  margin: 0;
  font-size: 1.4rem;
}
.login p {
  margin: 0;
}
</style>
