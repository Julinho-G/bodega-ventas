/**
 * Inicio del cajero: estado de SU caja.
 *  - Cerrada → formulario para abrirla con el sencillo inicial.
 *  - Abierta → resumen en vivo y formulario para cerrarla (cuadre).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Aviso, Boton, Campo, Etiqueta } from '../componentes/ui';
import { api } from '../lib/api';
import { CLAVE_CAJA, obtenerCaja, type CajaActual } from '../lib/caja';
import { hora, NOMBRE_METODO } from '../lib/textos';
import { leerMonto, soles } from '../lib/dinero';
import type { CierreTurno, Turno } from '../tipos';

export default function Caja() {
  const [cierre, setCierre] = useState<CierreTurno | null>(null);
  const caja = useQuery({
    queryKey: CLAVE_CAJA,
    queryFn: obtenerCaja,
    refetchInterval: 30_000, // el resumen se actualiza solo cada 30 segundos
  });

  if (cierre)
    return (
      <ResultadoCierre cierre={cierre} alContinuar={() => setCierre(null)} />
    );
  if (caja.isPending)
    return <p className="text-tinta-suave">Cargando tu caja…</p>;
  if (caja.isError) return <Aviso>{caja.error.message}</Aviso>;
  if (!caja.data) return <AbrirCaja />;
  return <CajaAbierta {...caja.data} alCerrar={setCierre} />;
}

// ---------------------------------------------------------------------------

function AbrirCaja() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const abrir = useMutation({
    mutationFn: (montoInicial: number) =>
      api<Turno>('/caja/abrir', { metodo: 'POST', cuerpo: { montoInicial } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['caja'] }),
    onError: (e) => setError(e.message),
  });

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const monto = leerMonto(String(new FormData(e.currentTarget).get('monto')));
    if (monto === null)
      return setError('Escribe un monto válido, por ejemplo 50 o 50.50');
    setError(null);
    abrir.mutate(monto);
  }

  return (
    <section className="max-w-md">
      <h1 className="text-2xl font-bold">Tu caja está cerrada</h1>
      <p className="mt-1 text-tinta-suave">
        Cuenta el sencillo que dejas en el cajón para dar vuelto y abre tu
        turno.
      </p>
      <form
        onSubmit={enviar}
        className="mt-5 flex flex-col gap-4 rounded-xl border border-linea bg-papel p-6"
      >
        <Campo
          etiqueta="Sencillo inicial (S/)"
          id="monto"
          name="monto"
          inputMode="decimal"
          placeholder="50.00"
          autoFocus
          required
        />
        {error && <Aviso>{error}</Aviso>}
        <Boton type="submit" disabled={abrir.isPending}>
          {abrir.isPending ? 'Abriendo…' : 'Abrir caja'}
        </Boton>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------

function CajaAbierta({
  turno,
  resumen,
  alCerrar,
}: CajaActual & { alCerrar: (c: CierreTurno) => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const cerrar = useMutation({
    mutationFn: (montoContado: number) =>
      api<CierreTurno>('/caja/cerrar', {
        metodo: 'POST',
        cuerpo: { montoContado },
      }),
    onSuccess: (resultado) => {
      alCerrar(resultado);
      queryClient.invalidateQueries({ queryKey: ['caja'] });
    },
    onError: (e) => setError(e.message),
  });

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const monto = leerMonto(
      String(new FormData(e.currentTarget).get('contado')),
    );
    if (monto === null)
      return setError('Escribe un monto válido, por ejemplo 120 o 120.50');
    setError(null);
    cerrar.mutate(monto);
  }

  const efectivo = resumen.ventasPorMetodo.find(
    (v) => v.metodo === 'EFECTIVO',
  )!;

  return (
    <div className="flex flex-col gap-6">
      <p className="flex items-center gap-2 font-semibold text-verde">
        <span aria-hidden className="size-2.5 rounded-full bg-verde" />
        Caja abierta desde las {hora(turno.apertura)}
      </p>

      <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
        {/* Lo más importante para el cajero: cuánto efectivo debe haber en el cajón */}
        <div>
          <Etiqueta>
            <p className="font-semibold">Efectivo que debe haber en el cajón</p>
            <p className="cifra mt-1 text-5xl leading-none">
              {soles(resumen.efectivoEsperado)}
            </p>
          </Etiqueta>
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-1 text-tinta-suave">
            <dt>Sencillo inicial</dt>
            <dd className="tabular-nums">{soles(resumen.montoInicial)}</dd>
            <dt>Ventas en efectivo</dt>
            <dd className="tabular-nums">+ {soles(efectivo.total)}</dd>
            <dt>Cobros de fiado</dt>
            <dd className="tabular-nums">
              + {soles(resumen.pagosFiadoRecibidos)}
            </dd>
          </dl>

          <section className="mt-8">
            <h2 className="text-lg font-bold">Cerrar caja</h2>
            <p className="mt-1 text-tinta-suave">
              Cuenta todo el efectivo del cajón, incluido el sencillo, y escribe
              el total.
            </p>
            <form
              onSubmit={enviar}
              className="mt-4 flex flex-col gap-4 rounded-xl border border-linea bg-papel p-6"
            >
              <Campo
                etiqueta="Efectivo contado (S/)"
                id="contado"
                name="contado"
                inputMode="decimal"
                placeholder="0.00"
                required
              />
              {error && <Aviso>{error}</Aviso>}
              <Boton
                type="submit"
                variante="secundario"
                disabled={cerrar.isPending}
              >
                {cerrar.isPending ? 'Cerrando…' : 'Cerrar caja'}
              </Boton>
            </form>
          </section>
        </div>

        <section className="self-start rounded-xl border border-linea bg-papel p-5">
          <h2 className="text-lg font-bold">Ventas de este turno</h2>
          <table className="mt-3 w-full">
            <thead className="sr-only">
              <tr>
                <th>Método</th>
                <th>Ventas</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {resumen.ventasPorMetodo.map((v) => (
                <tr
                  key={v.metodo}
                  className="border-b border-linea/60 last:border-0"
                >
                  <td className="py-2">{NOMBRE_METODO[v.metodo]}</td>
                  <td className="py-2 text-right text-tinta-suave tabular-nums">
                    {v.cantidad} {v.cantidad === 1 ? 'venta' : 'ventas'}
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums">
                    {soles(v.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 flex justify-between border-t-2 border-tinta pt-3 text-lg font-bold">
            <span>Total vendido</span>
            <span className="tabular-nums">{soles(resumen.totalVendido)}</span>
          </p>
          {resumen.ventasAnuladas > 0 && (
            <p className="mt-1 text-sm text-tinta-suave">
              {resumen.ventasAnuladas}{' '}
              {resumen.ventasAnuladas === 1
                ? 'venta anulada'
                : 'ventas anuladas'}{' '}
              (no suman)
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ResultadoCierre({
  cierre,
  alContinuar,
}: {
  cierre: CierreTurno;
  alContinuar: () => void;
}) {
  const diferencia = Number(cierre.diferencia);
  const texto =
    diferencia === 0
      ? 'La caja cuadra exacto.'
      : diferencia > 0
        ? `Sobran ${soles(diferencia)} en el cajón.`
        : `Faltan ${soles(-diferencia)} en el cajón.`;

  return (
    <section className="max-w-md">
      <h1 className="text-2xl font-bold">Caja cerrada</h1>
      <div className="mt-5 rounded-xl border border-linea bg-papel p-6">
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2">
          <dt>Debía haber</dt>
          <dd className="font-semibold tabular-nums">
            {soles(cierre.resumen.efectivoEsperado)}
          </dd>
          <dt>Contaste</dt>
          <dd className="font-semibold tabular-nums">
            {soles(cierre.montoContado)}
          </dd>
        </dl>
        <div className="mt-4">
          <Aviso tipo={diferencia === 0 ? 'ok' : 'error'}>{texto}</Aviso>
        </div>
        <Boton onClick={alContinuar} className="mt-5 w-full">
          Entendido
        </Boton>
      </div>
    </section>
  );
}
