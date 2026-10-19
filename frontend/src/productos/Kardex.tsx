/**
 * Kardex: historial de entradas y salidas de un producto con su saldo.
 * El backend verifica que el stock coincida con la suma de los movimientos ("cuadra").
 */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Aviso } from '../componentes/ui';
import { api } from '../lib/api';
import { diaMes, hora, NOMBRE_MOVIMIENTO, NOMBRE_UNIDAD } from '../lib/textos';
import type { Kardex as TipoKardex } from '../tipos';

const VISIBLES = 15;
const num = (v: string) => Number(v);

export default function Kardex({ productoId }: { productoId: number }) {
  const [todos, setTodos] = useState(false);
  const kardex = useQuery({
    queryKey: ['kardex', productoId],
    queryFn: () => api<TipoKardex>(`/inventario/kardex/${productoId}`),
  });

  if (kardex.isPending)
    return <p className="text-tinta-suave">Cargando movimientos…</p>;
  if (kardex.isError) return <Aviso>{kardex.error.message}</Aviso>;

  const k = kardex.data;
  const u = NOMBRE_UNIDAD[k.producto.unidad];
  // Lo más reciente primero: es lo que más se consulta
  const filas = [...k.movimientos].reverse();
  const mostradas = todos ? filas : filas.slice(0, VISIBLES);

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-bold">Movimientos (kardex)</h3>
        <p
          className={`text-sm font-semibold ${k.cuadra ? 'text-verde' : 'text-rojo'}`}
        >
          {k.cuadra
            ? 'El stock coincide con los movimientos'
            : 'El stock NO coincide con los movimientos: revisa el inventario'}
        </p>
      </div>

      {filas.length === 0 ? (
        <p className="mt-2 text-tinta-suave">
          Este producto aún no tiene movimientos.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[330px] text-sm">
            <thead>
              <tr className="border-b border-linea text-left text-tinta-suave">
                <th className="py-2 pr-2 font-semibold">Fecha</th>
                <th className="py-2 pr-2 font-semibold">Movimiento</th>
                <th className="py-2 pr-2 text-right font-semibold">Entra</th>
                <th className="py-2 pr-2 text-right font-semibold">Sale</th>
                <th className="py-2 text-right font-semibold">Queda</th>
              </tr>
            </thead>
            <tbody>
              {mostradas.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-linea/50 align-top last:border-0"
                >
                  <td className="py-2 pr-2 whitespace-nowrap text-tinta-suave tabular-nums">
                    <span className="block">{diaMes(m.fecha)}</span>
                    {hora(m.fecha)}
                  </td>
                  <td className="py-2 pr-2">
                    <span className="font-semibold">
                      {NOMBRE_MOVIMIENTO[m.tipo]}
                    </span>
                    {(m.motivo || m.ventaId) && (
                      <span className="block text-tinta-suave">
                        {m.motivo ?? `Venta N.º ${m.ventaId}`}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right text-verde tabular-nums">
                    {num(m.entrada) > 0 ? `+${num(m.entrada)}` : ''}
                  </td>
                  <td className="py-2 pr-2 text-right text-rojo tabular-nums">
                    {num(m.salida) > 0 ? `−${num(m.salida)}` : ''}
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums">
                    {num(m.saldo)} {u}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filas.length > VISIBLES && (
        <button
          type="button"
          onClick={() => setTodos((t) => !t)}
          className="mt-2 text-sm font-semibold underline underline-offset-2"
        >
          {todos
            ? 'Ver solo los últimos'
            : `Ver los ${filas.length} movimientos`}
        </button>
      )}
    </section>
  );
}
