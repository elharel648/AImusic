import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// served by FastAPI under /rack — assets must resolve from there
export default defineConfig({
  base: '/rack/',
  plugins: [react(), tailwindcss()],
})
