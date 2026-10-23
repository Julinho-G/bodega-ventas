import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import './index.css';
import { NOMBRE_BODEGA } from './lib/textos';
import { ProveedorSesion } from './sesion/sesion';

// Título de la pestaña del navegador con el nombre de la tienda
document.title = `Caja · ${NOMBRE_BODEGA}`;

// TanStack Query: guarda en memoria lo que llega de la API y lo vuelve a pedir cuando hace falta
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ProveedorSesion>
          <App />
        </ProveedorSesion>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
