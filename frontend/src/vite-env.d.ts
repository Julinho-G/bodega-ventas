/// <reference types="vite/client" />

// Variables del archivo .env que usa el frontend
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_NOMBRE_BODEGA?: string;
}
