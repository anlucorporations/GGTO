import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// La web se sirve desde el mismo origen que la API. En desarrollo, Vite
// reenvía /api al backend FastAPI (uvicorn en el puerto 8000).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
