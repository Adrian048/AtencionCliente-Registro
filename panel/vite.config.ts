import { fileURLToPath } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  build: {
    // The 3D engine (three.js, ~720 kB) is its own chunk, loaded only by the landing's 3D scene.
    chunkSizeWarningLimit: 800,
    // Two pages: the public landing (/) and the private management panel (/panel/)
    rollupOptions: {
      input: {
        landing: fileURLToPath(new URL('./index.html', import.meta.url)),
        panel: fileURLToPath(new URL('./panel/index.html', import.meta.url)),
      },
    },
  },
  server: {
    port: 9003,
    strictPort: true,
    // Same-origin in dev too, so the session cookie works without CORS.
    // /api goes to the compose stack's nginx (the API itself is not published).
    proxy: { '/api': 'http://127.0.0.1:9000' },
  },
  test: {
    environment: 'jsdom',
  },
})
