import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development the optional Bun server (npm run server) answers /api and /mcp; without it the app runs locally.
const server = process.env.C4SKETCH_SERVER ?? 'http://127.0.0.1:8787'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: server, ws: true, changeOrigin: false },
      '/mcp': { target: server, changeOrigin: false },
    },
  },
})
