import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const api = 'http://localhost:5154'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? '/Lce-Trivia/' : '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': api,
      '/uploads': api,
      '/hubs': { target: api, ws: true },
    },
  },
})
