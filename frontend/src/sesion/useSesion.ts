import { createContext, useContext } from 'react';
import type { Usuario } from '../tipos';

export type ValorSesion = {
  usuario: Usuario | null;
  estado: 'verificando' | 'lista';
  ingresar: (usuario: string, password: string) => Promise<void>;
  salir: () => void;
};

export const ContextoSesion = createContext<ValorSesion | null>(null);

/** Da acceso al usuario actual y a las acciones ingresar / salir */
export function useSesion() {
  const valor = useContext(ContextoSesion);
  if (!valor)
    throw new Error('useSesion debe usarse dentro de <ProveedorSesion>');
  return valor;
}
