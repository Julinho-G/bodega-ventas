/**
 * Ficha del cliente: cuánto debe, cobro de pagos a cuenta y estado de cuenta
 * (la "libreta" de fiados y pagos con su saldo).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Aviso, Boton, Etiqueta } from '../componentes/ui';
import { api } from '../lib/api';
import { leerMonto, soles } from '../lib/dinero';
import { diaMes, hora } from '../lib/textos';
import type { Cliente, EstadoCuenta } from '../tipos';
import FormCliente from './FormCliente';

/** El backend escribe las unidades en mayúsculas ("2 UND Leche"): se muestran como en el resto */
const legible = (detalle: string) =>
  detalle
    .replace(/ UND /g, ' und ')
    .replace(/ KG /g, ' kg ')
    .replace(/ LT /g, ' L ');

export default function PanelCliente({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const cuenta = useQuery({
    queryKey: ['clientes', 'cuenta', id],
    queryFn: () => api<EstadoCuenta>(`/clientes/${id}/estado-cuenta`),
  });
  const [editando, setEditando] = useState(false);
  const [monto, setMonto] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cobrar = useMutation({
    mutationFn: (valor: number) =>
      api<{ deudaRestante: string; cliente: Cliente }>(
        `/clientes/${id}/pagos`,
        {
          metodo: 'POST',
          cuerpo: { monto: valor },
        },
      ),
    onSuccess: async (r, valor) => {
      // Cambian la deuda (lista y ficha) y el efectivo esperado de la caja.
      // Se ESPERA a que la ficha se recargue antes de mostrar el aviso: así el aviso
      // ("ya no debe nada") y la ficha nunca se contradicen, ni por un instante.
      queryClient.invalidateQueries({ queryKey: ['caja'] });
      await queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setMonto('');
      setMensaje(
        Number(r.deudaRestante) === 0
          ? `Pago de ${soles(valor)} registrado. ${r.cliente.nombre} ya no debe nada.`
          : `Pago de ${soles(valor)} registrado. Ahora debe ${soles(r.deudaRestante)}.`,
      );
    },
    onError: (e) => setError(e.message),
  });

  if (cuenta.isPending)
    return <p className="text-tinta-suave">Cargando cliente…</p>;
  if (cuenta.isError) return <Aviso>{cuenta.error.message}</Aviso>;
  const { cliente: c, movimientos } = cuenta.data;
  const deuda = Number(c.deuda);

  if (editando) {
    return (
      <FormCliente
        cliente={c}
        alCancelar={() => setEditando(false)}
        alGuardar={() => {
          setEditando(false);
          setMensaje('Cambios guardados.');
        }}
      />
    );
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    const valor = leerMonto(monto);
    if (valor === null || valor <= 0)
      return setError('Escribe el monto, por ejemplo 10 o 10.50');
    if (valor > deuda)
      return setError(`Solo debe ${soles(deuda)}: no se puede cobrar más.`);
    setError(null);
    setMensaje(null);
    cobrar.mutate(valor);
  }

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-linea bg-papel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg leading-tight font-bold">{c.nombre}</h2>
          <p className="text-tinta-suave">
            {c.dni ? `DNI ${c.dni}` : 'Sin DNI'}
            {c.telefono && (
              <span className="ml-3 tabular-nums">Cel. {c.telefono}</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditando(true);
            setMensaje(null);
          }}
          className="shrink-0 rounded-lg border border-linea px-3 py-2 text-sm font-semibold hover:border-tinta focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
        >
          Editar
        </button>
      </div>

      {deuda > 0 ? (
        <Etiqueta>
          <p className="font-semibold">Debe</p>
          <p className="cifra mt-1 text-5xl leading-none">{soles(c.deuda)}</p>
        </Etiqueta>
      ) : (
        <p className="text-lg font-semibold text-verde">No tiene deuda.</p>
      )}
      <dl className="-mt-2 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-sm text-tinta-suave">Límite de crédito</dt>
          <dd className="font-semibold tabular-nums">
            {soles(c.limiteCredito)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-tinta-suave">Todavía puede fiar</dt>
          <dd className="font-semibold tabular-nums">
            {soles(c.creditoDisponible)}
          </dd>
        </div>
      </dl>

      {mensaje && <Aviso tipo="ok">{mensaje}</Aviso>}

      {deuda > 0 && (
        <form
          onSubmit={enviar}
          onChange={() => error && setError(null)}
          className="flex flex-col gap-2 border-t border-linea pt-4"
        >
          <label htmlFor="pago" className="font-semibold">
            Cobrar un pago a cuenta
          </label>
          <div className="flex gap-2">
            <input
              id="pago"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              inputMode="decimal"
              placeholder="S/ 0.00"
              autoComplete="off"
              className="h-12 min-w-0 flex-1 rounded-lg border border-linea bg-papel px-3 text-lg tabular-nums focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
            />
            <button
              type="button"
              onClick={() => {
                setMonto(deuda.toFixed(2));
                setError(null);
              }}
              className="h-12 rounded-lg border border-linea px-3 text-sm font-semibold hover:border-tinta focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
            >
              Todo
            </button>
          </div>
          <p className="text-sm text-tinta-suave">
            El pago entra en efectivo al cajón de tu caja abierta.
          </p>
          {error && <Aviso>{error}</Aviso>}
          <Boton type="submit" disabled={cobrar.isPending}>
            {cobrar.isPending ? 'Registrando…' : 'Registrar pago'}
          </Boton>
        </form>
      )}

      <section>
        <h3 className="font-bold">Estado de cuenta</h3>
        {movimientos.length === 0 ? (
          <p className="mt-2 text-tinta-suave">
            Todavía no tiene fiados ni pagos.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[330px] text-sm">
              <thead>
                <tr className="border-b border-linea text-left text-tinta-suave">
                  <th className="py-2 pr-2 font-semibold">Fecha</th>
                  <th className="py-2 pr-2 font-semibold">Detalle</th>
                  <th className="py-2 pr-2 text-right font-semibold">Monto</th>
                  <th className="py-2 text-right font-semibold">Debe</th>
                </tr>
              </thead>
              <tbody>
                {[...movimientos].reverse().map((m, i) => (
                  <tr
                    key={`${m.tipo}-${m.ventaId ?? i}-${m.fecha}`}
                    className="border-b border-linea/50 align-top last:border-0"
                  >
                    <td className="py-2 pr-2 whitespace-nowrap text-tinta-suave tabular-nums">
                      <span className="block">{diaMes(m.fecha)}</span>
                      {hora(m.fecha)}
                    </td>
                    <td className="py-2 pr-2">
                      <span className="font-semibold">
                        {m.tipo === 'FIADO'
                          ? `Fiado, venta N.º ${m.ventaId}`
                          : 'Pago a cuenta'}
                      </span>
                      {m.tipo === 'FIADO' && (
                        <span className="block text-tinta-suave">
                          {legible(m.detalle)}
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-2 pr-2 text-right whitespace-nowrap tabular-nums ${
                        m.tipo === 'PAGO' ? 'text-verde' : ''
                      }`}
                    >
                      {m.tipo === 'FIADO'
                        ? `+${soles(m.cargo)}`
                        : `−${soles(m.abono)}`}
                    </td>
                    <td className="py-2 text-right font-semibold whitespace-nowrap tabular-nums">
                      {soles(m.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
