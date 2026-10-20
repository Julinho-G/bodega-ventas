/**
 * Reportes para el dueño (solo ADMIN). Un selector de periodo arriba gobierna
 * todo lo de abajo: resumen, ventas por hora y por día, métodos de pago y
 * productos más vendidos. El inventario valorizado es siempre "al día de hoy".
 */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Aviso, Etiqueta } from '../componentes/ui';
import { api } from '../lib/api';
import { aCentimos, soles } from '../lib/dinero';
import {
  diasEntre,
  fechaCorta,
  fechaLarga,
  hoyEnLima,
  inicioDeMes,
  sumarDias,
} from '../lib/fechas';
import { NOMBRE_METODO, NOMBRE_UNIDAD } from '../lib/textos';
import Columnas, { type Columna } from '../reportes/Columnas';
import { useSesion } from '../sesion/useSesion';
import type {
  InventarioValorizado,
  RankingProductos,
  ResumenReporte,
} from '../tipos';

type Preset = 'hoy' | 'ayer' | 'semana' | 'mes' | 'otro';
type Orden = RankingProductos['orden'];

const PRESETS: { valor: Preset; texto: string }[] = [
  { valor: 'hoy', texto: 'Hoy' },
  { valor: 'ayer', texto: 'Ayer' },
  { valor: 'semana', texto: 'Últimos 7 días' },
  { valor: 'mes', texto: 'Este mes' },
  { valor: 'otro', texto: 'Otro periodo' },
];
const ORDENES: { valor: Orden; texto: string }[] = [
  { valor: 'cantidad', texto: 'Más vendidos' },
  { valor: 'importe', texto: 'Más dinero' },
  { valor: 'ganancia', texto: 'Más ganancia' },
];

function rango(preset: Preset, desde: string, hasta: string) {
  const hoy = hoyEnLima();
  if (preset === 'hoy') return { desde: hoy, hasta: hoy };
  if (preset === 'ayer')
    return { desde: sumarDias(hoy, -1), hasta: sumarDias(hoy, -1) };
  if (preset === 'semana') return { desde: sumarDias(hoy, -6), hasta: hoy };
  if (preset === 'mes') return { desde: inicioDeMes(hoy), hasta: hoy };
  return { desde, hasta };
}

/** 9 → "9 a. m.", 15 → "3 p. m." */
const hora12 = (h: number) =>
  `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'a. m.' : 'p. m.'}`;
const ventasTexto = (n: number) => (n === 1 ? '1 venta' : `${n} ventas`);

const chip = (activo: boolean) =>
  `rounded-lg border px-3 py-1.5 text-sm font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta ${
    activo
      ? 'border-tinta bg-tinta text-white'
      : 'border-linea bg-papel hover:border-tinta'
  }`;

export default function Reportes() {
  const { usuario } = useSesion();
  const hoy = hoyEnLima();
  const [preset, setPreset] = useState<Preset>('hoy');
  const [desdeOtro, setDesdeOtro] = useState(inicioDeMes(hoy));
  const [hastaOtro, setHastaOtro] = useState(hoy);
  const [orden, setOrden] = useState<Orden>('cantidad');

  const { desde, hasta } = rango(preset, desdeOtro, hastaOtro);
  const periodoValido = desde <= hasta && diasEntre(desde, hasta) <= 366;
  const consulta = `desde=${desde}&hasta=${hasta}`;

  const resumen = useQuery({
    queryKey: ['reportes', 'resumen', desde, hasta],
    queryFn: () => api<ResumenReporte>(`/reportes/resumen?${consulta}`),
    enabled: periodoValido,
    placeholderData: (anterior) => anterior,
  });
  const ranking = useQuery({
    queryKey: ['reportes', 'productos', desde, hasta, orden],
    queryFn: () =>
      api<RankingProductos>(
        `/reportes/productos?${consulta}&orden=${orden}&limite=10`,
      ),
    enabled: periodoValido,
    placeholderData: (anterior) => anterior,
  });
  const inventario = useQuery({
    queryKey: ['reportes', 'inventario'],
    queryFn: () => api<InventarioValorizado>('/reportes/inventario'),
  });

  if (usuario?.rol !== 'ADMIN') {
    return <Aviso>Solo el administrador puede ver los reportes.</Aviso>;
  }

  const r = resumen.data;
  const unDia = desde === hasta;
  const nombrePeriodo = unDia
    ? desde === hoy
      ? `hoy, ${fechaLarga(desde)}`
      : fechaLarga(desde)
    : `del ${fechaLarga(desde)} al ${fechaLarga(hasta)}`;

  // Horas: de 7 a. m. a 9 p. m. como mínimo, ampliando si hubo ventas fuera de ese horario
  const columnasHora: Columna[] = [];
  if (r) {
    const horas = r.porHora.map((h) => h.hora);
    const inicio = Math.min(7, ...horas);
    const fin = Math.max(21, ...horas);
    for (let h = inicio; h <= fin; h++) {
      const fila = r.porHora.find((x) => x.hora === h);
      columnasHora.push({
        clave: String(h),
        // En el eje, formato de 24 horas: así "7" (mañana) y "19" (noche) no se confunden
        etiqueta: String(h),
        titulo: `De ${hora12(h)} a ${hora12((h + 1) % 24)}`,
        valor: fila ? aCentimos(fila.total) : 0,
        texto: soles(fila?.total ?? 0),
        extra: ventasTexto(fila?.ventas ?? 0),
      });
    }
  }

  // Días: todos los del periodo (también los de cero ventas) si son hasta 62
  const columnasDia: Columna[] = [];
  if (r && !unDia) {
    const dias =
      diasEntre(desde, hasta) <= 62
        ? Array.from({ length: diasEntre(desde, hasta) }, (_, i) =>
            sumarDias(desde, i),
          )
        : r.porDia.map((d) => d.dia);
    for (const dia of dias) {
      const fila = r.porDia.find((d) => d.dia === dia);
      columnasDia.push({
        clave: dia,
        etiqueta: fechaCorta(dia),
        titulo: fechaLarga(dia),
        valor: fila ? aCentimos(fila.total) : 0,
        texto: soles(fila?.total ?? 0),
        extra: `${ventasTexto(fila?.ventas ?? 0)}, ganancia ${soles(fila?.ganancia ?? 0)}`,
      });
    }
  }

  const maxMetodo = r
    ? Math.max(...r.porMetodoPago.map((m) => aCentimos(m.total)), 0)
    : 0;
  const recargando = resumen.isPlaceholderData || ranking.isPlaceholderData;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="group"
          aria-label="Periodo"
        >
          {PRESETS.map((p) => (
            <button
              key={p.valor}
              type="button"
              aria-pressed={preset === p.valor}
              onClick={() => setPreset(p.valor)}
              className={chip(preset === p.valor)}
            >
              {p.texto}
            </button>
          ))}
        </div>
        {preset === 'otro' && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Desde
              <input
                type="date"
                value={desdeOtro}
                max={hoy}
                onChange={(e) => e.target.value && setDesdeOtro(e.target.value)}
                className="h-11 rounded-lg border border-linea bg-papel px-3 font-normal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Hasta
              <input
                type="date"
                value={hastaOtro}
                max={hoy}
                onChange={(e) => e.target.value && setHastaOtro(e.target.value)}
                className="h-11 rounded-lg border border-linea bg-papel px-3 font-normal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
              />
            </label>
          </div>
        )}
        {!periodoValido && (
          <div className="mt-3">
            <Aviso>
              {desde > hasta
                ? 'La fecha "Desde" no puede ser posterior a "Hasta".'
                : 'El periodo no puede ser mayor a un año.'}
            </Aviso>
          </div>
        )}
      </div>

      {resumen.isError && <Aviso>{resumen.error.message}</Aviso>}

      {r && periodoValido && (
        <div
          className={`flex flex-col gap-6 transition-opacity ${recargando ? 'opacity-60' : ''}`}
        >
          {/* Resumen del periodo */}
          <section className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:items-center">
            <Etiqueta>
              <p className="font-semibold">Vendido {nombrePeriodo}</p>
              <p className="cifra mt-1 text-5xl leading-none">
                {soles(r.totalVendido)}
              </p>
            </Etiqueta>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <div>
                <dt className="text-sm text-tinta-suave">Ganancia</dt>
                <dd className="text-xl font-bold tabular-nums">
                  {soles(r.gananciaBruta)}
                </dd>
                <dd className="text-sm text-tinta-suave">
                  {Number(r.margenPorcentaje)} % de lo vendido
                </dd>
              </div>
              <div>
                <dt className="text-sm text-tinta-suave">Ventas</dt>
                <dd className="text-xl font-bold tabular-nums">
                  {r.cantidadVentas}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-tinta-suave">Ticket promedio</dt>
                <dd className="text-xl font-bold tabular-nums">
                  {soles(r.ticketPromedio)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-tinta-suave">Anuladas</dt>
                <dd className="text-xl font-bold tabular-nums">
                  {r.anuladas.cantidad}
                </dd>
                {r.anuladas.cantidad > 0 && (
                  <dd className="text-sm text-tinta-suave">
                    por {soles(r.anuladas.monto)}, no suman
                  </dd>
                )}
              </div>
            </dl>
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <section className="rounded-xl border border-linea bg-papel p-5">
              <Columnas titulo="Ventas por hora" columnas={columnasHora} />
            </section>

            {/* Métodos de pago: barras horizontales con nombre y monto siempre visibles */}
            <section className="rounded-xl border border-linea bg-papel p-5">
              <h2 className="font-bold">Cómo pagaron</h2>
              <ul className="mt-3 flex flex-col gap-3">
                {r.porMetodoPago.map((m) => (
                  <li key={m.metodo}>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="font-semibold">
                        {NOMBRE_METODO[m.metodo]}
                      </span>
                      <span className="tabular-nums">
                        <span className="font-semibold">{soles(m.total)}</span>{' '}
                        <span className="text-tinta-suave">
                          ({ventasTexto(m.ventas)})
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 h-2.5 rounded-r-[4px] bg-pared">
                      <div
                        className="h-full rounded-r-[4px] bg-dato"
                        style={{
                          width: maxMetodo
                            ? `${(aCentimos(m.total) / maxMetodo) * 100}%`
                            : 0,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {!unDia && (
            <section className="rounded-xl border border-linea bg-papel p-5">
              <Columnas titulo="Ventas por día" columnas={columnasDia} />
            </section>
          )}

          {/* Ranking de productos */}
          <section className="rounded-xl border border-linea bg-papel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold">Productos</h2>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Ordenar productos"
              >
                {ORDENES.map((o) => (
                  <button
                    key={o.valor}
                    type="button"
                    aria-pressed={orden === o.valor}
                    onClick={() => setOrden(o.valor)}
                    className={chip(orden === o.valor)}
                  >
                    {o.texto}
                  </button>
                ))}
              </div>
            </div>
            {ranking.isError && (
              <div className="mt-3">
                <Aviso>{ranking.error.message}</Aviso>
              </div>
            )}
            {ranking.data && ranking.data.productos.length === 0 && (
              <p className="mt-3 text-tinta-suave">
                No se vendió ningún producto en este periodo.
              </p>
            )}
            {ranking.data && ranking.data.productos.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-linea text-left text-tinta-suave">
                      <th className="w-8 py-2 font-semibold">
                        <span className="sr-only">Puesto</span>
                      </th>
                      <th className="py-2 pr-2 font-semibold">Producto</th>
                      <th className="py-2 pr-2 text-right font-semibold">
                        Cantidad
                      </th>
                      <th className="py-2 pr-2 text-right font-semibold">
                        Vendido
                      </th>
                      <th className="py-2 text-right font-semibold">
                        Ganancia
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.data.productos.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-linea/50 last:border-0"
                      >
                        <td className="py-2 text-tinta-suave tabular-nums">
                          {p.puesto}
                        </td>
                        <td className="py-2 pr-2">
                          <span className="font-semibold">{p.nombre}</span>
                          <span className="block text-tinta-suave">
                            {p.categoria}, {ventasTexto(p.ventas)}
                          </span>
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {Number(p.cantidad)} {NOMBRE_UNIDAD[p.unidad]}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {soles(p.importe)}
                        </td>
                        <td className="py-2 text-right font-semibold tabular-nums">
                          {soles(p.ganancia)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Inventario: no depende del periodo */}
      <section className="rounded-xl border border-linea bg-papel p-5">
        <h2 className="font-bold">Mercadería en la bodega hoy</h2>
        <p className="text-sm text-tinta-suave">
          Lo que costó el stock actual y lo que valdría vendido a los precios de
          hoy.
        </p>
        {inventario.isError && (
          <div className="mt-3">
            <Aviso>{inventario.error.message}</Aviso>
          </div>
        )}
        {inventario.data && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-linea text-left text-tinta-suave">
                  <th className="py-2 pr-2 font-semibold">Categoría</th>
                  <th className="py-2 pr-2 text-right font-semibold">
                    Productos
                  </th>
                  <th className="py-2 pr-2 text-right font-semibold">
                    Por reponer
                  </th>
                  <th className="py-2 pr-2 text-right font-semibold">Costó</th>
                  <th className="py-2 pr-2 text-right font-semibold">
                    Vale vendido
                  </th>
                  <th className="py-2 text-right font-semibold">
                    Ganancia posible
                  </th>
                </tr>
              </thead>
              <tbody>
                {inventario.data.categorias.map((c) => (
                  <tr key={c.categoria} className="border-b border-linea/50">
                    <td className="py-2 pr-2 font-semibold">{c.categoria}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {c.productos}
                    </td>
                    <td
                      className={`py-2 pr-2 text-right tabular-nums ${c.stockBajo > 0 ? 'font-semibold text-rojo' : 'text-tinta-suave'}`}
                    >
                      {c.stockBajo}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {soles(c.valorCosto)}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {soles(c.valorVenta)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {soles(c.gananciaPotencial)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-tinta font-bold">
                  <td className="py-2 pr-2">Total</td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {inventario.data.totales.productos}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {inventario.data.totales.stockBajo}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {soles(inventario.data.totales.valorCosto)}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {soles(inventario.data.totales.valorVenta)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {soles(inventario.data.totales.gananciaPotencial)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
