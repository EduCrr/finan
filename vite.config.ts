import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          graficos: ['recharts'],
          vendor: ['react', 'react-dom', 'react-router-dom', '@supabase/supabase-js'],
        },
      },
    },
  },
})
