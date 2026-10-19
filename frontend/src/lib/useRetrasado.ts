import { useEffect, useState } from 'react';

/**
 * Devuelve el valor con un retraso: espera a que el usuario deje de escribir
 * antes de buscar (así no se hace una petición por cada tecla).
 */
export function useRetrasado<T>(valor: T, ms = 250): T {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setRetrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return retrasado;
}
