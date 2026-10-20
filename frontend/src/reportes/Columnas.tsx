/**
 * Gráfico de columnas de una sola serie (ventas por hora, ventas por día).
 * - Cada columna es un botón: al pasar el mouse o con el teclado (Tab) muestra su valor.
 * - Solo se rotula la columna más alta; el resto se lee en el detalle o en "Ver como tabla".
 * Hecho con HTML y CSS, sin librerías de gráficos.
 */
import { useState } from 'react';

export type Columna = {
  clave: string;
  /** Texto corto bajo la columna: "9", "16/10" */
  etiqueta: string;
  /** Nombre completo para el detalle: "9 a 10 a. m." */
  titulo: string;
  valor: number;
  /** Valor ya formateado: "S/ 45.50" */
  texto: string;
  /** Dato secundario: "4 ventas" */
  extra: string;
};

type Props = { titulo: string; columnas: Columna[]; alto?: number };

export default function Columnas({ titulo, columnas, alto = 160 }: Props) {
  const [activa, setActiva] = useState<string | null>(null);
  const [tabla, setTabla] = useState(false);
  const maximo = Math.max(...columnas.map((c) => c.valor), 0);
  const pico = columnas.find((c) => c.valor === maximo && maximo > 0);
  const elegida = columnas.find((c) => c.clave === activa) ?? null;

  return (
    <figure className="min-w-0">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-bold">{titulo}</span>
        <button
          type="button"
          onClick={() => setTabla((t) => !t)}
          className="text-sm font-semibold underline underline-offset-2"
        >
          {tabla ? 'Ver gráfico' : 'Ver como tabla'}
        </button>
      </figcaption>

      {maximo === 0 ? (
        <p className="mt-3 text-tinta-suave">Sin ventas en este periodo.</p>
      ) : tabla ? (
        <table className="mt-3 w-full text-sm">
          <tbody>
            {columnas
              .filter((c) => c.valor > 0)
              .map((c) => (
                <tr
                  key={c.clave}
                  className="border-b border-linea/50 last:border-0"
                >
                  <td className="py-1.5">{c.titulo}</td>
                  <td className="py-1.5 text-right text-tinta-suave">
                    {c.extra}
                  </td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">
                    {c.texto}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      ) : (
        <>
          {/* Detalle de la columna señalada (o del pico, si no hay ninguna señalada) */}
          <p className="mt-2 min-h-6 text-sm" aria-live="polite">
            {(elegida ?? pico) && (
              <>
                <span className="font-bold tabular-nums">
                  {(elegida ?? pico)!.texto}
                </span>{' '}
                <span className="text-tinta-suave">
                  {(elegida ?? pico)!.titulo}, {(elegida ?? pico)!.extra}
                  {!elegida && ' (el mayor)'}
                </span>
              </>
            )}
          </p>
          <div className="mt-1 overflow-x-auto">
            <div
              className="flex items-end gap-[2px] border-b border-linea"
              style={{ height: alto, minWidth: columnas.length * 14 }}
              onMouseLeave={() => setActiva(null)}
            >
              {columnas.map((c) => (
                <button
                  key={c.clave}
                  type="button"
                  aria-label={`${c.titulo}: ${c.texto}, ${c.extra}`}
                  onMouseEnter={() => setActiva(c.clave)}
                  onFocus={() => setActiva(c.clave)}
                  onBlur={() => setActiva(null)}
                  // El área que reacciona es toda la franja vertical, no solo la barra pintada
                  className="group flex h-full min-w-3 flex-1 items-end justify-center focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tinta"
                >
                  <span
                    className={`block w-full max-w-6 rounded-t-[4px] transition-colors ${
                      activa === c.clave
                        ? 'bg-tinta'
                        : 'bg-dato group-hover:bg-tinta'
                    }`}
                    style={{
                      height:
                        c.valor > 0
                          ? `max(${(c.valor / maximo) * 100}%, 2px)`
                          : 0,
                    }}
                  />
                </button>
              ))}
            </div>
            <div
              className="flex gap-[2px] pt-1"
              style={{ minWidth: columnas.length * 14 }}
            >
              {columnas.map((c, i) => (
                <span
                  key={c.clave}
                  aria-hidden
                  className="min-w-3 flex-1 text-center text-xs text-tinta-suave tabular-nums"
                >
                  {/* Con muchas columnas se rotula una de cada dos para que no se encimen */}
                  {columnas.length <= 16 || i % 2 === 0 ? c.etiqueta : ''}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </figure>
  );
}
