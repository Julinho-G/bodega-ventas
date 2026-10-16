import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// El backend permite peticiones desde http://localhost:5173 (FRONTEND_URL en backend/.env),
// por eso el puerto queda fijo: si estuviera ocupado, Vite avisa en vez de usar otro.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
});
