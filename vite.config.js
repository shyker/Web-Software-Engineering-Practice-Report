import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 8899,
    watch: {
      ignored: ['**/.agents/**', '**/.claude/**', '**/.codex/**', '**/skills/**']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8900',
        changeOrigin: true
      }
    }
  }
})
