import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = (env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true
        },
        '/uploads': {
          target: backendUrl,
          changeOrigin: true
        }
      }
    }
  }
})
