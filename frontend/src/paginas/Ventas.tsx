/**
 * Ventas del turno abierto: lista, detalle y anulación.
 * Anular NO borra la venta: queda como ANULADA y el stock vuelve al inventario.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Aviso, Boton } from '../componentes/ui';
import { api } from '../lib/api';
import { CLAVE_CAJA, obtenerCaja } from '../lib/caja';
import { aCentimos, soles, solesDeCentimos } from '../lib/dinero';
import { hora, NOMBRE_METODO, NOMBRE_UNIDAD } from '../lib/textos';
import type { Pagina, Venta, VentaResumen } from '../tipos';

/** Motivos frecuentes: un clic en vez de escribir */
const MOTIVOS = [
  'Error al registrar',
  'El cliente devolvió el producto',
  'Cobro duplicado',
];

export default function Ventas() {
  const caja = useQuery({ queryKey: CLAVE_CAJA, queryFn: obtenerCaja });
  const turnoId = caja.data?.turno.id;
  const ventas = useQuery({
    queryKey: ['ventas', 'turno', turnoId],
    queryFn: () =>
      api<Pagina<VentaResumen>>(`/ventas?turnoId=${turnoId}&limite=200`),
    enabled: turnoId !== undefined,
  });
  const [elegida, setElegida] = useState<number | null>(null);
  const [anulada, setAnulada] = useState<number | null>(null);

  if (caja.isPending) return <p className="text-tinta-suave">Cargando…</p>;
  if (caja.isError) return <Aviso>{caja.error.message}</Aviso>;
  if (!caja.data) {
    return (
      <section className="max-w-md">
        <h1 className="text-2xl font-bold">No tienes la caja abierta</h1>
        <p className="mt-1 text-tinta-suave">
          Aquí aparecen las ventas de tu turno. Abre tu caja para empezar.
        </p>
        <Link
          to="/caja"
          className="mt-5 inline-flex h-12 items-center rounded-lg bg-tinta px-5 font-semibold text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
        >
          Ir a abrir caja
        </Link>
      </section>
    );
  }

  const lista = ventas.data?.datos ?? [];
  // Conteo y total salen de la MISMA lista, así siempre coinciden entre sí
  const ventasPagadas = lista.filter((v) => v.estado === 'PAGADA');
  const pagadas = ventasPagadas.length;
  const totalPagado = ventasPagadas.reduce(
    (acc, v) => acc + aCentimos(v.total),
    0,
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
      <section className="min-w-0">
        <h1 className="text-2xl font-bold">Ventas de tu turno</h1>
        <p className="mt-1 text-tinta-suave">
          Desde las {hora(caja.data.turno.apertura)}:{' '}
          {pagadas === 1 ? '1 venta' : `${pagadas} ventas`} por{' '}
          {solesDeCentimos(totalPagado)}
          {lista.length > pagadas &&
            ` (${lista.length - pagadas} ${lista.length - pagadas === 1 ? 'anulada' : 'anuladas'})`}
          .
        </p>

        {anulada !== null && (
          <div className="mt-4">
            <Aviso tipo="ok">
              La venta N.º {anulada} quedó anulada y sus productos volvieron al
              inventario.
            </Aviso>
          </div>
        )}

        {ventas.isPending && (
          <p className="mt-4 text-tinta-suave">Cargando ventas…</p>
        )}
        {ventas.isError && (
          <div className="mt-4">
            <Aviso>{ventas.error.message}</Aviso>
          </div>
        )}
        {ventas.isSuccess && lista.length === 0 && (
          <div className="mt-5 rounded-xl border-2 border-dashed border-linea p-8 text-center text-tinta-suave">
            Todavía no hay ventas en este turno.{' '}
            <Link
              to="/"
              className="font-semibold text-tinta underline underline-offset-2"
            >
              Ir a vender
            </Link>
          </div>
        )}

        {lista.length > 0 && (
          <ul className="mt-5 overflow-hidden rounded-xl border border-linea bg-papel">
            {lista.map((v) => {
              const esAnulada = v.estado === 'ANULADA';
              return (
                <li
                  key={v.id}
                  className="border-b border-linea/60 last:border-0"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setElegida(v.id);
                      // En pantallas angostas el detalle queda debajo de la lista: se lleva a la vista
                      if (!window.matchMedia('(min-width: 1024px)').matches) {
                        setTimeout(() =>
                          document
                            .getElementById('detalle-venta')
                            ?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'start',
                            }),
                        );
                      }
                      setAnulada(null);
                    }}
                    aria-current={elegida === v.id}
                    className={`grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-4 px-4 py-3 text-left hover:bg-pared focus-visible:bg-pared focus-visible:outline-none ${
                      elegida === v.id ? 'bg-pared' : ''
                    }`}
                  >
                    <span className="w-20 whitespace-nowrap text-tinta-suave tabular-nums">
                      {hora(v.fecha)}
                    </span>
                    <span className="min-w-0">
                      <span className="font-semibold">N.º {v.id}</span>{' '}
                      <span className="text-tinta-suave">
                        {NOMBRE_METODO[v.metodoPago]}
                        {v.cliente && `, ${v.cliente.nombre}`}
                      </span>
                      <span className="block text-sm text-tinta-suave">
                        {v._count.detalles}{' '}
                        {v._count.detalles === 1 ? 'producto' : 'productos'}
                      </span>
                    </span>
                    <span className="text-right">
                      <span
                        className={`block font-bold tabular-nums ${esAnulada ? 'text-tinta-suave line-through' : ''}`}
                      >
                        {soles(v.total)}
                      </span>
                      {esAnulada && (
                        <span className="text-sm font-semibold text-rojo">
                          Anulada
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <aside
        id="detalle-venta"
        className="min-w-0 scroll-mt-4 lg:sticky lg:top-6"
      >
        {elegida === null ? (
          <p className="rounded-xl border-2 border-dashed border-linea p-6 text-tinta-suave">
            Elige una venta para ver sus productos o anularla.
          </p>
        ) : (
          <DetalleVenta
            key={elegida}
            id={elegida}
            alAnular={(id) => {
              setAnulada(id);
              setElegida(null);
            }}
          />
        )}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------

function DetalleVenta({
  id,
  alAnular,
}: {
  id: number;
  alAnular: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const venta = useQuery({
    queryKey: ['ventas', 'detalle', id],
    queryFn: () => api<Venta>(`/ventas/${id}`),
  });
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const anular = useMutation({
    mutationFn: () =>
      api<Venta>(`/ventas/${id}/anular`, {
        metodo: 'POST',
        cuerpo: { motivo: motivo.trim() },
      }),
    onSuccess: () => {
      // Cambian: la lista, el resumen de la caja, el stock y quizá la deuda de un cliente
      for (const clave of ['ventas', 'caja', 'productos', 'clientes']) {
        queryClient.invalidateQueries({ queryKey: [clave] });
      }
      alAnular(id);
    },
    onError: (e) => setError(e.message),
  });

  function confirmar(e: FormEvent) {
    e.preventDefault();
    if (!motivo.trim())
      return setError('Escribe o elige el motivo de la anulación');
    setError(null);
    anular.mutate();
  }

  if (venta.isPending)
    return <p className="text-tinta-suave">Cargando venta…</p>;
  if (venta.isError) return <Aviso>{venta.error.message}</Aviso>;
  const v = venta.data;
  const esAnulada = v.estado === 'ANULADA';

  return (
    <section className="rounded-xl border border-linea bg-papel p-5">
      <h2 className="text-lg font-bold">Venta N.º {v.id}</h2>
      <p className="text-tinta-suave">
        {hora(v.fecha)}, {NOMBRE_METODO[v.metodoPago].toLowerCase()}
      </p>

      <ul className="mt-4 flex flex-col gap-1.5">
        {v.detalles.map((d) => (
          <li key={d.id} className="flex justify-between gap-4">
            <span>
              {Number(d.cantidad)} {NOMBRE_UNIDAD[d.producto.unidad]}{' '}
              {d.producto.nombre}
            </span>
            <span className="tabular-nums">{soles(d.subtotal)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex justify-between border-t-2 border-tinta pt-3 text-lg font-bold">
        <span>Total</span>
        <span
          className={`tabular-nums ${esAnulada ? 'text-tinta-suave line-through' : ''}`}
        >
          {soles(v.total)}
        </span>
      </p>

      {esAnulada ? (
        <p className="mt-4 font-semibold text-rojo">
          Esta venta está anulada: no suma en la caja y su stock ya se devolvió.
        </p>
      ) : !anulando ? (
        <Boton
          variante="secundario"
          onClick={() => setAnulando(true)}
          className="mt-5 w-full"
        >
          Anular esta venta
        </Boton>
      ) : (
        <form
          onSubmit={confirmar}
          className="mt-5 flex flex-col gap-3 border-t border-linea pt-4"
        >
          <p className="font-semibold">¿Por qué se anula?</p>
          <div className="flex flex-wrap gap-2">
            {MOTIVOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMotivo(m);
                  setError(null);
                }}
                aria-pressed={motivo === m}
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta ${
                  motivo === m
                    ? 'border-tinta bg-tinta text-white'
                    : 'border-linea hover:border-tinta'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <label htmlFor="motivo" className="sr-only">
            Motivo
          </label>
          <input
            id="motivo"
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              setError(null);
            }}
            maxLength={200}
            placeholder="O escribe el motivo"
            className="h-11 rounded-lg border border-linea bg-papel px-3 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
          />
          <p className="text-sm text-tinta-suave">
            La venta no se borra: queda registrada como anulada y los productos
            vuelven al inventario.
          </p>
          {error && <Aviso>{error}</Aviso>}
          <div className="flex gap-2">
            <Boton
              type="button"
              variante="secundario"
              onClick={() => {
                setAnulando(false);
                setError(null);
              }}
              className="flex-1"
            >
              Volver
            </Boton>
            <button
              type="submit"
              disabled={anular.isPending}
              className="h-12 flex-1 rounded-lg bg-rojo px-4 font-semibold text-white hover:bg-[#9a1d14] disabled:cursor-wait focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
            >
              {anular.isPending ? 'Anulando…' : `Anular N.º ${v.id}`}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
