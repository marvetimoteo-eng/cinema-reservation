import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development the React app (port 5173) forwards /api calls to the Express server (port 3001).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3001' } },
})
