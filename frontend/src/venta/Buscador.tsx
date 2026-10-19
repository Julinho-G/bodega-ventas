/**
 * Buscador de productos para la caja.
 *  - Lector de código de barras: escribe el código muy rápido y presiona Enter solo.
 *  - Por nombre: muestra sugerencias mientras se escribe (flechas + Enter para elegir).
 *  - Multiplicador: "6*7750243001234" agrega 6 unidades de una vez.
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type KeyboardEvent, type RefObject } from 'react';
import { api, ErrorApi } from '../lib/api';
import { leerCantidad, soles } from '../lib/dinero';
import { NOMBRE_UNIDAD } from '../lib/textos';
import type { Pagina, Producto } from '../tipos';

type Props = {
  campoRef: RefObject<HTMLInputElement | null>;
  alElegir: (producto: Producto, cantidad: number | null) => void;
};

/** Separa "6*arroz" en { cantidad: "6", busqueda: "arroz" } */
function separar(texto: string) {
  const partes = texto.match(/^\s*(\d+(?:[.,]\d{1,3})?)\s*\*\s*(.*)$/);
  return partes
    ? { cantidad: partes[1], busqueda: partes[2].trim() }
    : { cantidad: null, busqueda: texto.trim() };
}

/** Espera a que el cajero deje de escribir antes de buscar (no una petición por tecla) */
function useRetrasado(valor: string, ms: number) {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setRetrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return retrasado;
}

const sinStock = (p: Producto) => Number(p.stock) <= 0;

export default function Buscador({ campoRef, alElegir }: Props) {
  const [texto, setTexto] = useState('');
  const [marcado, setMarcado] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { cantidad, busqueda } = separar(texto);
  const busquedaRetrasada = useRetrasado(busqueda, 250);
  const sugerencias = useQuery({
    queryKey: ['productos', 'buscar', busquedaRetrasada],
    queryFn: () =>
      api<Pagina<Producto>>(
        `/productos?buscar=${encodeURIComponent(busquedaRetrasada)}&limite=8`,
      ),
    enabled: busquedaRetrasada.length >= 2,
  });
  // Solo se muestran resultados del texto ACTUAL: mientras llega la búsqueda nueva,
  // la lista anterior se oculta para no elegir por error un producto de la búsqueda previa
  const alDia =
    busqueda.length >= 2 &&
    busquedaRetrasada === busqueda &&
    sugerencias.isSuccess;
  const lista = alDia ? sugerencias.data.datos : [];
  const sinResultados =
    alDia && lista.length === 0 && !/^\d{4,}$/.test(busqueda);

  /**
   * Agrega el producto con la cantidad indicada antes del "*".
   * limpiar=false cuando el campo ya se vació (lectura de código de barras).
   */
  function elegir(producto: Producto, cantTexto = cantidad, limpiar = true) {
    if (sinStock(producto)) {
      setError(`"${producto.nombre}" no tiene stock`);
      return;
    }
    let cant: number | null = null;
    if (cantTexto !== null) {
      cant = leerCantidad(cantTexto, producto.unidad);
      if (cant === null) {
        setError(
          producto.unidad === 'UND'
            ? `"${producto.nombre}" se vende por unidad: usa un número entero`
            : 'Cantidad no válida: usa hasta 3 decimales, por ejemplo 0.25',
        );
        return;
      }
    }
    alElegir(producto, cant);
    if (limpiar) setTexto('');
    setMarcado(0);
    setError(null);
  }

  async function alPresionar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (lista.length === 0) return;
      const paso = e.key === 'ArrowDown' ? 1 : -1;
      setMarcado((m) => (m + paso + lista.length) % lista.length);
      return;
    }
    if (e.key === 'Escape') {
      setTexto('');
      setError(null);
      return;
    }
    if (e.key !== 'Enter' || !busqueda) return;
    e.preventDefault();

    // Solo números: es un código de barras (del lector o escrito a mano)
    if (/^\d{4,}$/.test(busqueda)) {
      // Se vacía el campo YA: el lector puede estar escribiendo el siguiente código
      const codigo = busqueda;
      const cantTexto = cantidad;
      setTexto('');
      try {
        const producto = await api<Producto>(`/productos/codigo/${codigo}`);
        elegir(producto, cantTexto, false);
      } catch (err) {
        setError(
          err instanceof ErrorApi && err.status === 404
            ? `No hay ningún producto con el código ${codigo}`
            : err instanceof Error
              ? err.message
              : 'No se pudo buscar el código',
        );
      }
      return;
    }
    // Texto: se elige la sugerencia marcada (si ya llegaron las sugerencias)
    if (lista[marcado]) elegir(lista[marcado]);
  }

  const abierto = lista.length > 0;

  return (
    <div className="relative">
      <label htmlFor="buscar" className="text-sm font-semibold">
        Escanea el código o escribe el nombre del producto
      </label>
      <input
        ref={campoRef}
        id="buscar"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setMarcado(0);
          setError(null);
        }}
        onKeyDown={alPresionar}
        autoComplete="off"
        autoFocus
        role="combobox"
        aria-expanded={abierto}
        aria-controls="sugerencias"
        aria-activedescendant={abierto ? `sugerencia-${marcado}` : undefined}
        placeholder="Ej.: arroz, 7750243001234 o 6*galleta"
        className="mt-1.5 h-14 w-full rounded-lg border-2 border-tinta bg-papel px-4 text-xl placeholder:text-base placeholder:text-tinta-suave/60 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
      />
      {sinResultados && !error && (
        <p className="mt-2 text-tinta-suave">
          No hay productos que coincidan con “{busqueda}”.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 font-medium text-rojo">
          {error}
        </p>
      )}

      {abierto && (
        <ul
          id="sugerencias"
          role="listbox"
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-linea bg-papel shadow-lg"
        >
          {lista.map((p, i) => (
            <li
              key={p.id}
              id={`sugerencia-${i}`}
              role="option"
              aria-selected={i === marcado}
              aria-disabled={sinStock(p)}
              // onMouseDown (y no onClick) para que el campo no pierda el foco antes de elegir
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(p);
              }}
              onMouseEnter={() => setMarcado(i)}
              className={`flex cursor-pointer items-center justify-between gap-4 px-4 py-2.5 ${
                i === marcado ? 'bg-pared' : ''
              } ${sinStock(p) ? 'opacity-50' : ''}`}
            >
              <span>
                <span className="font-semibold">{p.nombre}</span>
                <span className="block text-sm text-tinta-suave">
                  {sinStock(p)
                    ? 'Sin stock'
                    : `Quedan ${Number(p.stock)} ${NOMBRE_UNIDAD[p.unidad]}`}
                  {p.codigoBarras && (
                    <span className="ml-3 tabular-nums">
                      Cód. {p.codigoBarras}
                    </span>
                  )}
                </span>
              </span>
              <span className="font-bold whitespace-nowrap tabular-nums">
                {soles(p.precioVenta)}
                {p.unidad !== 'UND' && (
                  <span className="font-normal text-tinta-suave">
                    {' '}
                    / {NOMBRE_UNIDAD[p.unidad]}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
