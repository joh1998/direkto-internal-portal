import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Prevent Vite from walking up to the root tsconfig (Expo)
  optimizeDeps: {
    entries: ['src/main.tsx'],
  },

  server: {
    port: 5173,
    open: false,
    proxy: {
      '/api/v1': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port: 5173,
    open: false,
    proxy: {
      '/api/v1': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router'],
          ui: ['recharts', 'lucide-react', 'sonner'],
          map: ['maplibre-gl'],
        },
      },
    },
  },

  assetsInclude: ['**/*.svg', '**/*.csv'],
})
