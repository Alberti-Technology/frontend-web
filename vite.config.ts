import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/blogs': 'http://localhost:8000',
      '/member': 'http://localhost:8000',
      '/metalografia': 'http://localhost:8000',
      '/ping': 'http://localhost:8000',
      '/create-superuser': 'http://localhost:8000',
      '/reports': 'http://localhost:8000',
      '/media': 'http://localhost:8000',
      '/admin': 'http://localhost:8000',
      '/static': 'http://localhost:8000',
      '/ws': {
        target: 'http://localhost:8000',
        ws: true
      }
    }
  },
})
