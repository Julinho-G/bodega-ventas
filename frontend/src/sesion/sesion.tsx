/**
 * Sesión del usuario: guarda el token, lo comprueba al abrir la app
 * y lo borra al salir o cuando el backend lo rechaza.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, configurarApi } from '../lib/api';
import type { Usuario } from '../tipos';
import { ContextoSesion } from './useSesion';

type Sesion = { token: string; usuario: Usuario };
type Estado = 'verificando' | 'lista';

const CLAVE = 'bodega.sesion';

// localStorage puede fallar (modo privado, permisos): por eso todo va en try/catch
function leerGuardada(): Sesion | null {
  try {
    const texto = localStorage.getItem(CLAVE);
    return texto ? (JSON.parse(texto) as Sesion) : null;
  } catch {
    return null;
  }
}
function guardar(sesion: Sesion | null) {
  try {
    if (sesion) localStorage.setItem(CLAVE, JSON.stringify(sesion));
    else localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento: la sesión dura hasta recargar la página */
  }
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [sesion, setSesion] = useState<Sesion | null>(leerGuardada);
  const [estado, setEstado] = useState<Estado>(
    sesion ? 'verificando' : 'lista',
  );

  const salir = useCallback(() => {
    guardar(null);
    setSesion(null);
    queryClient.clear(); // que el siguiente usuario no vea datos del anterior
  }, [queryClient]);

  // Se hace durante el render (y no en un useEffect) para que las pantallas hijas
  // ya tengan el token en su primera petición
  configurarApi(sesion?.token ?? null, salir);

  // Al abrir la app con una sesión guardada, se comprueba que el token siga vigente
  useEffect(() => {
    if (estado !== 'verificando') return;
    api<Usuario>('/auth/perfil')
      .then((usuario) => {
        setSesion((s) => (s ? { ...s, usuario } : s));
        setEstado('lista');
      })
      // Si respondió 401, el cliente de la API ya cerró la sesión.
      // Si no hay conexión, la sesión se conserva y la pantalla mostrará el aviso.
      .catch(() => setEstado('lista'));
  }, [estado]);

  const ingresar = useCallback(async (usuario: string, password: string) => {
    const nueva = await api<{ accessToken: string; usuario: Usuario }>(
      '/auth/login',
      {
        metodo: 'POST',
        cuerpo: { usuario, password },
      },
    );
    const sesionNueva = { token: nueva.accessToken, usuario: nueva.usuario };
    guardar(sesionNueva);
    setSesion(sesionNueva);
    setEstado('lista');
  }, []);

  return (
    <ContextoSesion.Provider
      value={{ usuario: sesion?.usuario ?? null, estado, ingresar, salir }}
    >
      {children}
    </ContextoSesion.Provider>
  );
}
