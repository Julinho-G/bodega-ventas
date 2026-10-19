/**
 * Pantalla principal del cajero: arma la venta y cobra.
 * Flujo: escanear/buscar → ajustar cantidades → elegir método → Cobrar (F2) → vuelto.
 */
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Aviso, Boton, Etiqueta } from '../componentes/ui';
import { CLAVE_CAJA, obtenerCaja } from '../lib/caja';
import { soles } from '../lib/dinero';
import { NOMBRE_METODO, NOMBRE_UNIDAD } from '../lib/textos';
import type { Venta } from '../tipos';
import Buscador from '../venta/Buscador';
import { useCarrito } from '../venta/carrito';
import Cobro from '../venta/Cobro';
import TablaCarrito from '../venta/TablaCarrito';

export default function Vender() {
  const caja = useQuery({ queryKey: CLAVE_CAJA, queryFn: obtenerCaja });
  const carrito = useCarrito();
  const buscador = useRef<HTMLInputElement>(null);
  const [enfocarId, setEnfocarId] = useState<number | null>(null);
  const [registrada, setRegistrada] = useState<Venta | null>(null);

  if (caja.isPending) return <p className="text-tinta-suave">Cargando…</p>;
  if (caja.isError) return <Aviso>{caja.error.message}</Aviso>;
  if (!caja.data) {
    return (
      <section className="max-w-md">
        <h1 className="text-2xl font-bold">
          Abre tu caja para empezar a vender
        </h1>
        <p className="mt-1 text-tinta-suave">
          Las ventas se registran en tu turno, así que primero cuenta el
          sencillo y abre la caja.
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

  if (registrada) {
    return (
      <VentaRegistrada
        venta={registrada}
        alContinuar={() => {
          setRegistrada(null);
          setTimeout(() => buscador.current?.focus());
        }}
      />
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_400px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Buscador
          campoRef={buscador}
          alElegir={(producto, cantidad) => {
            carrito.agregar(producto, cantidad);
            // A granel sin cantidad: el cursor pasa al campo de peso; si no, sigue en el buscador
            if (producto.unidad !== 'UND' && cantidad === null)
              setEnfocarId(producto.id);
            else setEnfocarId(null);
          }}
        />
        <TablaCarrito
          carrito={carrito}
          enfocarId={enfocarId}
          alTerminar={() => {
            setEnfocarId(null);
            buscador.current?.focus();
          }}
        />
        {carrito.lineas.length > 0 && (
          <button
            type="button"
            onClick={() => {
              carrito.vaciar();
              buscador.current?.focus();
            }}
            className="self-start text-sm font-semibold text-tinta-suave underline underline-offset-2 hover:text-rojo"
          >
            Vaciar la venta
          </button>
        )}
      </div>

      <aside className="min-w-0 lg:sticky lg:top-6">
        <Cobro
          carrito={carrito}
          alRegistrar={(venta) => {
            carrito.vaciar();
            setRegistrada(venta);
          }}
        />
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------

function VentaRegistrada({
  venta,
  alContinuar,
}: {
  venta: Venta;
  alContinuar: () => void;
}) {
  const conVuelto = venta.vuelto != null && venta.metodoPago === 'EFECTIVO';
  return (
    <section className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Venta registrada</h1>
      <p className="mt-1 text-tinta-suave">
        Venta N.º {venta.id}, pagada con{' '}
        {NOMBRE_METODO[venta.metodoPago].toLowerCase()}.
      </p>

      <Etiqueta className="mt-5">
        <p className="font-semibold">
          {conVuelto ? 'Vuelto para el cliente' : 'Total cobrado'}
        </p>
        <p className="cifra mt-1 text-6xl leading-none">
          {soles(conVuelto ? venta.vuelto! : venta.total)}
        </p>
      </Etiqueta>

      <div className="mt-5 rounded-xl border border-linea bg-papel p-5">
        <ul className="flex flex-col gap-1.5">
          {venta.detalles.map((d) => (
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
          <span className="tabular-nums">{soles(venta.total)}</span>
        </p>
        {conVuelto && (
          <p className="mt-1 flex justify-between text-tinta-suave">
            <span>Pagó con</span>
            <span className="tabular-nums">{soles(venta.montoRecibido!)}</span>
          </p>
        )}
      </div>

      <Boton onClick={alContinuar} autoFocus className="mt-5 w-full">
        Nueva venta
      </Boton>
    </section>
  );
}
