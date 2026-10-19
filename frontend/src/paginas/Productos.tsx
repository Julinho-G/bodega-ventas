/**
 * Productos e inventario (solo ADMIN): lista con búsqueda y filtros a la izquierda,
 * ficha del producto elegido (o el formulario de uno nuevo) a la derecha.
 */
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Aviso } from '../componentes/ui';
import { api } from '../lib/api';
import { soles } from '../lib/dinero';
import { NOMBRE_UNIDAD } from '../lib/textos';
import { useRetrasado } from '../lib/useRetrasado';
import FormProducto from '../productos/FormProducto';
import PanelProducto from '../productos/PanelProducto';
import { useSesion } from '../sesion/useSesion';
import type { Pagina, Producto } from '../tipos';

type Filtro = 'activos' | 'bajo' | 'todos';
const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: 'activos', texto: 'En venta' },
  { valor: 'bajo', texto: 'Stock bajo' },
  { valor: 'todos', texto: 'Todos, con descontinuados' },
];
const POR_PAGINA = 30;

/** Para comparar sin tildes ni mayúsculas: "Azúcar" → "azucar" */
const normalizar = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Productos() {
  const { usuario } = useSesion();
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('activos');
  const [pagina, setPagina] = useState(1);
  const [elegido, setElegido] = useState<number | 'nuevo' | null>(null);
  const buscar = useRetrasado(texto.trim(), 250);

  const lista = useQuery({
    queryKey: ['productos', 'lista', filtro, buscar, pagina],
    queryFn: async (): Promise<Pagina<Producto>> => {
      if (filtro === 'bajo') {
        // Este endpoint devuelve todos los de stock bajo (sin páginas); se filtra aquí
        const todos = await api<Producto[]>('/productos/stock-bajo');
        const datos = buscar
          ? todos.filter((p) =>
              normalizar(p.nombre).includes(normalizar(buscar)),
            )
          : todos;
        return { datos, total: datos.length, pagina: 1, limite: datos.length };
      }
      const params = new URLSearchParams({
        pagina: String(pagina),
        limite: String(POR_PAGINA),
      });
      if (buscar) params.set('buscar', buscar);
      if (filtro === 'todos') params.set('incluirInactivos', 'true');
      return api<Pagina<Producto>>(`/productos?${params}`);
    },
    placeholderData: (anterior) => anterior, // sin parpadeo al cambiar de página
  });

  if (usuario?.rol !== 'ADMIN') {
    return (
      <Aviso>
        Solo el administrador puede gestionar los productos y el inventario.
      </Aviso>
    );
  }

  const datos = lista.data?.datos ?? [];
  const total = lista.data?.total ?? 0;
  const paginas =
    filtro === 'bajo' ? 1 : Math.max(1, Math.ceil(total / POR_PAGINA));

  function elegir(id: number | 'nuevo') {
    setElegido(id);
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      setTimeout(() =>
        document
          .getElementById('ficha-producto')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_420px]">
      <section className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Productos</h1>
          <button
            type="button"
            onClick={() => elegir('nuevo')}
            className="flex h-11 items-center gap-2 rounded-lg bg-tinta px-4 font-semibold text-white hover:bg-[#25335a] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
          >
            <Plus aria-hidden className="size-4" />
            Nuevo producto
          </button>
        </div>

        <label htmlFor="buscar-producto" className="sr-only">
          Buscar producto
        </label>
        <input
          id="buscar-producto"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setPagina(1);
          }}
          placeholder="Buscar por nombre o código de barras"
          autoComplete="off"
          className="mt-4 h-12 w-full rounded-lg border border-linea bg-papel px-4 text-lg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
        />

        <div
          className="mt-3 flex flex-wrap gap-2"
          role="group"
          aria-label="Filtrar productos"
        >
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              aria-pressed={filtro === f.valor}
              onClick={() => {
                setFiltro(f.valor);
                setPagina(1);
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta ${
                filtro === f.valor
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
        {lista.isSuccess && datos.length === 0 && (
          <p className="mt-5 rounded-xl border-2 border-dashed border-linea p-8 text-center text-tinta-suave">
            {filtro === 'bajo'
              ? 'Ningún producto está por debajo de su stock mínimo.'
              : buscar
                ? `No hay productos que coincidan con “${buscar}”.`
                : 'Todavía no hay productos. Crea el primero con “Nuevo producto”.'}
          </p>
        )}

        {datos.length > 0 && (
          <ul className="mt-4 overflow-hidden rounded-xl border border-linea bg-papel">
            {datos.map((p) => (
              <li key={p.id} className="border-b border-linea/60 last:border-0">
                <button
                  type="button"
                  onClick={() => elegir(p.id)}
                  aria-current={elegido === p.id}
                  className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-3 text-left hover:bg-pared focus-visible:bg-pared focus-visible:outline-none ${
                    elegido === p.id ? 'bg-pared' : ''
                  } ${p.activo ? '' : 'opacity-60'}`}
                >
                  <span className="min-w-0">
                    <span className="font-semibold">{p.nombre}</span>
                    <span className="block text-sm text-tinta-suave">
                      {p.categoria.nombre}
                      {!p.activo && (
                        <span className="ml-2 font-semibold text-rojo">
                          Descontinuado
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-bold tabular-nums">
                      {soles(p.precioVenta)}
                      {p.unidad !== 'UND' && (
                        <span className="font-normal text-tinta-suave">
                          {' '}
                          /{NOMBRE_UNIDAD[p.unidad]}
                        </span>
                      )}
                    </span>
                    <span
                      className={`text-sm tabular-nums ${p.stockBajo ? 'font-semibold text-rojo' : 'text-tinta-suave'}`}
                    >
                      {Number(p.stock)} {NOMBRE_UNIDAD[p.unidad]}
                      {p.stockBajo && ', reponer'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {paginas > 1 && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={pagina === 1}
              onClick={() => setPagina((n) => n - 1)}
              className="rounded-lg border border-linea bg-papel px-3 py-2 text-sm font-semibold hover:border-tinta disabled:opacity-40"
            >
              Anterior
            </button>
            <p className="text-sm text-tinta-suave">
              Página {pagina} de {paginas} ({total} productos)
            </p>
            <button
              type="button"
              disabled={pagina >= paginas}
              onClick={() => setPagina((n) => n + 1)}
              className="rounded-lg border border-linea bg-papel px-3 py-2 text-sm font-semibold hover:border-tinta disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        )}
      </section>

      <aside id="ficha-producto" className="min-w-0 scroll-mt-4">
        {elegido === null ? (
          <p className="rounded-xl border-2 border-dashed border-linea p-6 text-tinta-suave">
            Elige un producto para ver su stock, registrar mercadería, mermas o
            conteos, y revisar su kardex.
          </p>
        ) : elegido === 'nuevo' ? (
          <FormProducto
            alCancelar={() => setElegido(null)}
            alGuardar={(p) => setElegido(p.id)}
          />
        ) : (
          <PanelProducto key={elegido} id={elegido} />
        )}
      </aside>
    </div>
  );
}
