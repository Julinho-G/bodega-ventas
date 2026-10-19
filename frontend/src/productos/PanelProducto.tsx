/** Ficha de un producto: precios, stock, acciones de inventario, edición y kardex */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Aviso } from '../componentes/ui';
import { api } from '../lib/api';
import { soles } from '../lib/dinero';
import { NOMBRE_UNIDAD } from '../lib/textos';
import type { Producto } from '../tipos';
import FormProducto from './FormProducto';
import Kardex from './Kardex';
import MovimientosStock, { type Accion } from './MovimientosStock';

const ACCIONES: { valor: Accion; texto: string }[] = [
  { valor: 'ingreso', texto: 'Llegó mercadería' },
  { valor: 'merma', texto: 'Merma' },
  { valor: 'conteo', texto: 'Conteo' },
];

export default function PanelProducto({ id }: { id: number }) {
  const producto = useQuery({
    queryKey: ['productos', 'detalle', id],
    queryFn: () => api<Producto>(`/productos/${id}`),
  });
  const [modo, setModo] = useState<Accion | 'editar' | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  if (producto.isPending)
    return <p className="text-tinta-suave">Cargando producto…</p>;
  if (producto.isError) return <Aviso>{producto.error.message}</Aviso>;
  const p = producto.data;
  const u = NOMBRE_UNIDAD[p.unidad];

  if (modo === 'editar') {
    return (
      <FormProducto
        producto={p}
        alCancelar={() => setModo(null)}
        alGuardar={() => {
          setModo(null);
          setMensaje('Cambios guardados.');
        }}
      />
    );
  }

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-linea bg-papel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg leading-tight font-bold">{p.nombre}</h2>
          <p className="text-tinta-suave">
            {p.categoria.nombre}
            {p.codigoBarras && (
              <span className="ml-2 tabular-nums">Cód. {p.codigoBarras}</span>
            )}
          </p>
          {!p.activo && (
            <p className="mt-1 font-semibold text-rojo">
              Descontinuado: no aparece en la caja
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setModo('editar');
            setMensaje(null);
          }}
          className="shrink-0 rounded-lg border border-linea px-3 py-2 text-sm font-semibold hover:border-tinta focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
        >
          Editar
        </button>
      </div>

      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="text-sm text-tinta-suave">Costo</dt>
          <dd className="font-semibold tabular-nums">
            {soles(p.precioCompra)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-tinta-suave">Precio</dt>
          <dd className="font-semibold tabular-nums">{soles(p.precioVenta)}</dd>
        </div>
        <div>
          <dt className="text-sm text-tinta-suave">En stock</dt>
          <dd
            className={`font-bold tabular-nums ${p.stockBajo ? 'text-rojo' : ''}`}
          >
            {Number(p.stock)} {u}
          </dd>
        </div>
      </dl>
      {p.stockBajo && (
        <p className="-mt-3 text-sm font-semibold text-rojo">
          Stock bajo: el aviso es a partir de {Number(p.stockMinimo)} {u}. Toca
          reponer.
        </p>
      )}

      {mensaje && <Aviso tipo="ok">{mensaje}</Aviso>}

      <div>
        <div
          role="tablist"
          aria-label="Cambiar el stock"
          className="grid grid-cols-3 gap-2"
        >
          {ACCIONES.map((a) => (
            <button
              key={a.valor}
              type="button"
              role="tab"
              aria-selected={modo === a.valor}
              onClick={() => {
                setModo(modo === a.valor ? null : a.valor);
                setMensaje(null);
              }}
              className={`h-11 rounded-lg border px-2 text-sm font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta ${
                modo === a.valor
                  ? 'border-tinta bg-tinta text-white'
                  : 'border-linea hover:border-tinta'
              }`}
            >
              {a.texto}
            </button>
          ))}
        </div>
        {modo !== null && (
          <div className="mt-4">
            <MovimientosStock
              key={modo}
              producto={p}
              accion={modo}
              alTerminar={(m) => {
                setModo(null);
                setMensaje(m);
              }}
            />
          </div>
        )}
      </div>

      <Kardex productoId={p.id} />
    </section>
  );
}
