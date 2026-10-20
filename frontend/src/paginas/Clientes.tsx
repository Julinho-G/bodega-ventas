/**
 * Clientes y fiado: lista (todos o solo los que deben) a la izquierda,
 * ficha del cliente con su estado de cuenta a la derecha.
 */
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import FormCliente from '../clientes/FormCliente';
import PanelCliente from '../clientes/PanelCliente';
import { Aviso } from '../componentes/ui';
import { api } from '../lib/api';
import { aCentimos, soles, solesDeCentimos } from '../lib/dinero';
import { useRetrasado } from '../lib/useRetrasado';
import type { Cliente } from '../tipos';

export default function Clientes() {
  const [texto, setTexto] = useState('');
  const [soloDeudores, setSoloDeudores] = useState(false);
  const [elegido, setElegido] = useState<number | 'nuevo' | null>(null);
  const buscar = useRetrasado(texto.trim(), 250);

  const lista = useQuery({
    queryKey: ['clientes', 'lista', buscar, soloDeudores],
    queryFn: () => {
      const params = new URLSearchParams();
      if (buscar) params.set('buscar', buscar);
      if (soloDeudores) params.set('soloDeudores', 'true');
      return api<Cliente[]>(`/clientes?${params}`);
    },
    placeholderData: (anterior) => anterior,
  });

  const clientes = lista.data ?? [];
  const deudores = clientes.filter((c) => Number(c.deuda) > 0);
  const totalDeuda = deudores.reduce((acc, c) => acc + aCentimos(c.deuda), 0);

  function elegir(id: number | 'nuevo') {
    setElegido(id);
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      setTimeout(() =>
        document
          .getElementById('ficha-cliente')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_420px]">
      <section className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Clientes</h1>
          <button
            type="button"
            onClick={() => elegir('nuevo')}
            className="flex h-11 items-center gap-2 rounded-lg bg-tinta px-4 font-semibold text-white hover:bg-[#25335a] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
          >
            <Plus aria-hidden className="size-4" />
            Nuevo cliente
          </button>
        </div>
        {lista.isSuccess && deudores.length > 0 && (
          <p className="mt-1 text-tinta-suave">
            {deudores.length === 1
              ? '1 cliente debe'
              : `${deudores.length} clientes deben`}{' '}
            {solesDeCentimos(totalDeuda)}
            {buscar && ' (en esta búsqueda)'}.
          </p>
        )}

        <label htmlFor="buscar-cliente" className="sr-only">
          Buscar cliente
        </label>
        <input
          id="buscar-cliente"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por nombre o DNI"
          autoComplete="off"
          className="mt-4 h-12 w-full rounded-lg border border-linea bg-papel px-4 text-lg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
        />
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="group"
          aria-label="Filtrar clientes"
        >
          {[
            { valor: false, texto: 'Todos' },
            { valor: true, texto: 'Solo los que deben' },
          ].map((f) => (
            <button
              key={f.texto}
              type="button"
              aria-pressed={soloDeudores === f.valor}
              onClick={() => setSoloDeudores(f.valor)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta ${
                soloDeudores === f.valor
                  ? 'border-tinta bg-tinta text-white'
                  : 'border-linea bg-papel hover:border-tinta'
              }`}
            >
              {f.texto}
            </button>
          ))}
        </div>

        {lista.isError && (
          <div className="mt-4">
            <Aviso>{lista.error.message}</Aviso>
          </div>
        )}
        {lista.isSuccess && clientes.length === 0 && (
          <p className="mt-5 rounded-xl border-2 border-dashed border-linea p-8 text-center text-tinta-suave">
            {soloDeudores
              ? 'Nadie debe nada.'
              : buscar
                ? `No hay clientes que coincidan con “${buscar}”.`
                : 'Todavía no hay clientes. Registra el primero con “Nuevo cliente”.'}
          </p>
        )}

        {clientes.length > 0 && (
          <ul className="mt-4 overflow-hidden rounded-xl border border-linea bg-papel">
            {clientes.map((c) => {
              const debe = Number(c.deuda) > 0;
              return (
                <li
                  key={c.id}
                  className="border-b border-linea/60 last:border-0"
                >
                  <button
                    type="button"
                    onClick={() => elegir(c.id)}
                    aria-current={elegido === c.id}
                    className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-3 text-left hover:bg-pared focus-visible:bg-pared focus-visible:outline-none ${
                      elegido === c.id ? 'bg-pared' : ''
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="font-semibold">{c.nombre}</span>
                      <span className="block text-sm text-tinta-suave">
                        {c.dni ? `DNI ${c.dni}` : 'Sin DNI'}
                        {c.telefono && (
                          <span className="ml-3">Cel. {c.telefono}</span>
                        )}
                      </span>
                    </span>
                    <span className="text-right">
                      <span
                        className={`block font-bold tabular-nums ${debe ? 'text-rojo' : 'text-tinta-suave'}`}
                      >
                        {debe ? `Debe ${soles(c.deuda)}` : 'No debe'}
                      </span>
                      <span className="text-sm text-tinta-suave tabular-nums">
                        Puede fiar {soles(c.creditoDisponible)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <aside id="ficha-cliente" className="min-w-0 scroll-mt-4">
        {elegido === null ? (
          <p className="rounded-xl border-2 border-dashed border-linea p-6 text-tinta-suave">
            Elige un cliente para ver cuánto debe, cobrarle un pago o revisar su
            estado de cuenta.
          </p>
        ) : elegido === 'nuevo' ? (
          <FormCliente
            alCancelar={() => setElegido(null)}
            alGuardar={(c) => setElegido(c.id)}
          />
        ) : (
          <PanelCliente key={elegido} id={elegido} />
        )}
      </aside>
    </div>
  );
}
