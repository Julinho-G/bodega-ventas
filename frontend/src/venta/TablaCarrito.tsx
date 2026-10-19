/** Lista de productos de la venta en curso, con cantidades editables */
import { Minus, Plus, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { leerCantidad, soles, solesDeCentimos } from '../lib/dinero';
import { NOMBRE_UNIDAD } from '../lib/textos';
import type { Carrito } from './carrito';

type Props = {
  carrito: Carrito;
  /** Producto a granel recién agregado: su campo de peso recibe el foco */
  enfocarId: number | null;
  /** Al terminar de escribir una cantidad (Enter) se vuelve al buscador */
  alTerminar: () => void;
};

const botonIcono =
  'grid size-9 place-items-center rounded-lg border border-linea bg-papel hover:border-tinta focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta';

export default function TablaCarrito({
  carrito,
  enfocarId,
  alTerminar,
}: Props) {
  const campos = useRef(new Map<number, HTMLInputElement>());

  useEffect(() => {
    if (enfocarId !== null) campos.current.get(enfocarId)?.focus();
  }, [enfocarId]);

  if (carrito.lineas.length === 0) {
    return (
      <div className="grid min-h-48 place-items-center rounded-xl border-2 border-dashed border-linea p-8 text-center text-tinta-suave">
        <p>
          Aún no hay productos en esta venta.
          <br />
          Escanea un código o busca por nombre para empezar.
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-x-auto rounded-xl border border-linea bg-papel">
      <table className="w-full min-w-[560px]">
        <thead>
          <tr className="border-b border-linea text-left text-sm text-tinta-suave">
            <th className="px-4 py-2.5 font-semibold">Producto</th>
            <th className="px-2 py-2.5 text-right font-semibold">Precio</th>
            <th className="px-2 py-2.5 text-center font-semibold">Cantidad</th>
            <th className="px-4 py-2.5 text-right font-semibold">Subtotal</th>
            <th className="w-12">
              <span className="sr-only">Quitar</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {carrito.lineas.map((l) => {
            const p = l.producto;
            const porUnidad = p.unidad === 'UND';
            const invalida = l.cantidadValida === null;
            const actual = leerCantidad(l.cantidad, p.unidad) ?? 0;
            return (
              <tr key={p.id} className="border-b border-linea/60 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-semibold">{p.nombre}</p>
                  <p className="text-sm text-tinta-suave">
                    Quedan {Number(p.stock)} {NOMBRE_UNIDAD[p.unidad]}
                  </p>
                </td>
                <td className="px-2 py-3 text-right whitespace-nowrap tabular-nums">
                  {soles(p.precioVenta)}
                  {!porUnidad && (
                    <span className="text-tinta-suave">
                      {' '}
                      /{NOMBRE_UNIDAD[p.unidad]}
                    </span>
                  )}
                </td>
                <td className="px-2 py-3">
                  <div className="flex items-center justify-center gap-1.5">
                    {porUnidad && (
                      <button
                        type="button"
                        aria-label={`Restar 1 a ${p.nombre}`}
                        disabled={actual <= 1}
                        onClick={() =>
                          carrito.cambiar(p.id, String(actual - 1))
                        }
                        className={`${botonIcono} disabled:opacity-40`}
                      >
                        <Minus className="size-4" aria-hidden />
                      </button>
                    )}
                    <input
                      ref={(el) => {
                        if (el) campos.current.set(p.id, el);
                        else campos.current.delete(p.id);
                      }}
                      value={l.cantidad}
                      onChange={(e) => carrito.cambiar(p.id, e.target.value)}
                      onKeyDown={(e) =>
                        e.key === 'Enter' && !invalida && alTerminar()
                      }
                      inputMode={porUnidad ? 'numeric' : 'decimal'}
                      aria-label={`Cantidad de ${p.nombre}${porUnidad ? '' : ' en ' + NOMBRE_UNIDAD[p.unidad]}`}
                      aria-invalid={invalida}
                      placeholder={porUnidad ? '1' : '0.000'}
                      className={`h-9 w-20 rounded-lg border bg-papel text-center text-lg tabular-nums focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta ${
                        invalida ? 'border-rojo bg-rojo-fondo' : 'border-linea'
                      }`}
                    />
                    {porUnidad ? (
                      <button
                        type="button"
                        aria-label={`Sumar 1 a ${p.nombre}`}
                        onClick={() =>
                          carrito.cambiar(p.id, String(actual + 1))
                        }
                        className={botonIcono}
                      >
                        <Plus className="size-4" aria-hidden />
                      </button>
                    ) : (
                      <span className="w-6 text-tinta-suave">
                        {NOMBRE_UNIDAD[p.unidad]}
                      </span>
                    )}
                  </div>
                  {invalida && (
                    <p className="mt-1 text-center text-sm text-rojo">
                      {porUnidad ? 'Número entero' : 'Escribe el peso'}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">
                  {invalida ? '—' : solesDeCentimos(l.subtotal)}
                </td>
                <td className="pr-3">
                  <button
                    type="button"
                    aria-label={`Quitar ${p.nombre}`}
                    onClick={() => carrito.quitar(p.id)}
                    className={`${botonIcono} text-tinta-suave hover:text-rojo`}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
