/**
 * Panel de cobro: total, método de pago, con cuánto paga (vuelto) o a quién se fía.
 * Se cobra con el botón o con la tecla F2.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Aviso, Boton, Etiqueta } from '../componentes/ui';
import { api } from '../lib/api';
import { aCentimos, leerMonto, soles, solesDeCentimos } from '../lib/dinero';
import { NOMBRE_METODO } from '../lib/textos';
import type { Cliente, MetodoPago, Venta } from '../tipos';
import type { Carrito } from './carrito';

type Props = {
  carrito: Carrito;
  alRegistrar: (venta: Venta) => void;
};

const METODOS: MetodoPago[] = ['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'FIADO'];
const BILLETES = [10, 20, 50, 100, 200];

export default function Cobro({ carrito, alRegistrar }: Props) {
  const queryClient = useQueryClient();
  const formulario = useRef<HTMLFormElement>(null);
  const [metodo, setMetodo] = useState<MetodoPago>('EFECTIVO');
  const [recibido, setRecibido] = useState('');
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = carrito.totalCentimos;
  const recibidoNum = recibido.trim() ? leerMonto(recibido) : null;
  const recibidoCent = recibidoNum === null ? null : aCentimos(recibidoNum);
  const falta = recibidoCent !== null && recibidoCent < total;
  const excedeCredito =
    metodo === 'FIADO' &&
    cliente !== null &&
    total > aCentimos(cliente.creditoDisponible);

  const registrar = useMutation({
    mutationFn: () =>
      api<Venta>('/ventas', {
        metodo: 'POST',
        cuerpo: {
          items: carrito.lineas.map((l) => ({
            productoId: l.producto.id,
            cantidad: l.cantidadValida,
          })),
          metodoPago: metodo,
          ...(metodo === 'EFECTIVO' &&
            recibidoNum !== null && { montoRecibido: recibidoNum }),
          ...(metodo === 'FIADO' && cliente && { clienteId: cliente.id }),
        },
      }),
    onSuccess: (venta) => {
      // Cambió el stock, el resumen de la caja y quizá la deuda de un cliente
      queryClient.invalidateQueries({ queryKey: ['caja'] });
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['ventas'] });
      setMetodo('EFECTIVO');
      setRecibido('');
      setCliente(null);
      setError(null);
      alRegistrar(venta);
    },
    onError: (e) => setError(e.message),
  });

  // Motivo por el que todavía no se puede cobrar (null = se puede)
  const pendiente = !carrito.lineas.length
    ? 'Agrega productos a la venta'
    : !carrito.completo
      ? 'Revisa las cantidades marcadas en rojo'
      : recibido.trim() && recibidoNum === null
        ? 'El monto recibido no es válido'
        : falta
          ? 'El cliente pagó menos que el total'
          : metodo === 'FIADO' && !cliente
            ? 'Elige a quién se le fía'
            : excedeCredito
              ? 'El fiado supera el crédito disponible del cliente'
              : null;

  function cobrar(e?: FormEvent) {
    e?.preventDefault();
    if (pendiente || registrar.isPending) return;
    registrar.mutate();
  }

  // F2 cobra desde cualquier parte de la pantalla
  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if (e.key === 'F2') {
        e.preventDefault();
        formulario.current?.requestSubmit();
      }
    }
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, []);

  const billetes = BILLETES.filter((b) => b * 100 > total).slice(0, 3);

  return (
    <form ref={formulario} onSubmit={cobrar} className="flex flex-col gap-5">
      <Etiqueta>
        <p className="font-semibold">Total a cobrar</p>
        <p className="cifra mt-1 text-6xl leading-none" aria-live="polite">
          {solesDeCentimos(total)}
        </p>
      </Etiqueta>

      <fieldset>
        <legend className="text-sm font-semibold">Método de pago</legend>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {METODOS.map((m) => (
            <label
              key={m}
              className={`flex h-11 cursor-pointer items-center justify-center rounded-lg border font-semibold has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-tinta ${
                metodo === m
                  ? 'border-tinta bg-tinta text-white'
                  : 'border-linea bg-papel hover:border-tinta'
              }`}
            >
              <input
                type="radio"
                name="metodo"
                value={m}
                checked={metodo === m}
                onChange={() => {
                  setMetodo(m);
                  setError(null);
                }}
                className="sr-only"
              />
              {NOMBRE_METODO[m]}
            </label>
          ))}
        </div>
      </fieldset>

      {metodo === 'EFECTIVO' && (
        <div>
          <label htmlFor="recibido" className="text-sm font-semibold">
            Paga con (S/)
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="recibido"
              value={recibido}
              onChange={(e) => setRecibido(e.target.value)}
              inputMode="decimal"
              placeholder="Opcional"
              autoComplete="off"
              className="h-11 min-w-0 flex-1 rounded-lg border border-linea bg-papel px-3 text-lg tabular-nums focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
            />
            {billetes.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setRecibido(String(b))}
                className="h-11 rounded-lg border border-linea bg-papel px-3 font-semibold tabular-nums hover:border-tinta focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
              >
                {b}
              </button>
            ))}
          </div>
          {recibidoCent !== null && total > 0 && (
            <p
              className={`mt-2 text-xl font-bold tabular-nums ${falta ? 'text-rojo' : 'text-verde'}`}
            >
              {falta
                ? `Faltan ${solesDeCentimos(total - recibidoCent)}`
                : `Vuelto: ${solesDeCentimos(recibidoCent - total)}`}
            </p>
          )}
        </div>
      )}

      {metodo === 'FIADO' && (
        <ElegirCliente
          cliente={cliente}
          alElegir={setCliente}
          totalCentimos={total}
        />
      )}

      {error && <Aviso>{error}</Aviso>}

      <div>
        <Boton
          type="submit"
          disabled={registrar.isPending}
          aria-disabled={pendiente !== null}
          className={`h-14 w-full text-lg ${pendiente ? 'opacity-50' : ''}`}
        >
          {registrar.isPending
            ? 'Registrando…'
            : `Cobrar ${solesDeCentimos(total)}`}
          <kbd className="ml-3 rounded border border-white/40 px-1.5 py-0.5 text-sm font-normal">
            F2
          </kbd>
        </Boton>
        {pendiente && carrito.lineas.length > 0 && (
          <p className="mt-2 text-sm text-tinta-suave">{pendiente}</p>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

function ElegirCliente({
  cliente,
  alElegir,
  totalCentimos,
}: {
  cliente: Cliente | null;
  alElegir: (c: Cliente | null) => void;
  totalCentimos: number;
}) {
  const [texto, setTexto] = useState('');
  const buscar = texto.trim();
  const clientes = useQuery({
    queryKey: ['clientes', 'buscar', buscar],
    queryFn: () =>
      api<Cliente[]>(`/clientes?buscar=${encodeURIComponent(buscar)}`),
    enabled: buscar.length >= 2 && !cliente,
  });

  if (cliente) {
    const alcanza = totalCentimos <= aCentimos(cliente.creditoDisponible);
    return (
      <div className="rounded-lg border border-linea bg-papel p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{cliente.nombre}</p>
            <p className="text-sm text-tinta-suave">
              Debe {soles(cliente.deuda)} de un límite de{' '}
              {soles(cliente.limiteCredito)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => alElegir(null)}
            className="text-sm font-semibold underline underline-offset-2"
          >
            Cambiar
          </button>
        </div>
        <p className={`mt-2 font-bold ${alcanza ? 'text-verde' : 'text-rojo'}`}>
          Puede fiar hasta {soles(cliente.creditoDisponible)}
        </p>
      </div>
    );
  }

  const lista = buscar.length >= 2 ? (clientes.data ?? []).slice(0, 5) : [];
  return (
    <div>
      <label htmlFor="cliente" className="text-sm font-semibold">
        ¿A quién se le fía?
      </label>
      <input
        id="cliente"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Nombre o DNI del cliente"
        autoComplete="off"
        className="mt-1.5 h-11 w-full rounded-lg border border-linea bg-papel px-3 text-lg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
      />
      {lista.length > 0 && (
        <ul className="mt-1 overflow-hidden rounded-lg border border-linea bg-papel">
          {lista.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => alElegir(c)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-pared focus-visible:bg-pared focus-visible:outline-none"
              >
                <span className="font-semibold">{c.nombre}</span>
                <span className="text-sm whitespace-nowrap text-tinta-suave">
                  Puede fiar {soles(c.creditoDisponible)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {buscar.length >= 2 && clientes.isSuccess && lista.length === 0 && (
        <p className="mt-2 text-sm text-tinta-suave">
          No hay clientes con ese nombre o DNI. El administrador puede
          registrarlo.
        </p>
      )}
    </div>
  );
}
