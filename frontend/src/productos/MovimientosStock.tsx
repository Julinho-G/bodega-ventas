/**
 * Las tres formas de cambiar el stock a mano (solo ADMIN), cada una deja su
 * movimiento en el kardex:
 *  - Llegó mercadería → ENTRADA (puede actualizar costo y precio)
 *  - Merma            → MERMA (vencido, roto, perdido)
 *  - Conteo           → AJUSTE por la diferencia con lo que hay en el anaquel
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Aviso, Boton, Campo } from '../componentes/ui';
import { api } from '../lib/api';
import { leerCantidad, leerCantidadOCero, leerMonto } from '../lib/dinero';
import { NOMBRE_UNIDAD } from '../lib/textos';
import type { Producto } from '../tipos';

export type Accion = 'ingreso' | 'merma' | 'conteo';

type Props = {
  producto: Producto;
  accion: Accion;
  alTerminar: (mensaje: string) => void;
};

const MOTIVOS_MERMA = ['Vencido', 'Roto o dañado', 'Perdido'];

/** "61.000" → "61" */
const cantidad = (valor: string | number) => String(Number(valor));

export default function MovimientosStock({
  producto,
  accion,
  alTerminar,
}: Props) {
  const queryClient = useQueryClient();
  const u = NOMBRE_UNIDAD[producto.unidad];
  const [cant, setCant] = useState('');
  const [costo, setCosto] = useState('');
  const [precio, setPrecio] = useState('');
  const [motivo, setMotivo] = useState(
    accion === 'conteo' ? 'Conteo de anaquel' : '',
  );
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);

  const registrar = useMutation({
    mutationFn: (peticion: { ruta: string; cuerpo: object }) =>
      api<{
        stockNuevo?: string;
        productos?: { stockNuevo: string }[];
        resultado?: string;
        diferencia?: string;
      }>(peticion.ruta, { metodo: 'POST', cuerpo: peticion.cuerpo }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      queryClient.invalidateQueries({ queryKey: ['kardex', producto.id] });
      const nuevo = cantidad(r.stockNuevo ?? r.productos?.[0]?.stockNuevo ?? 0);
      alTerminar(
        accion === 'ingreso'
          ? `Ingreso registrado. Ahora hay ${nuevo} ${u}.`
          : accion === 'merma'
            ? `Merma registrada. Ahora hay ${nuevo} ${u}.`
            : `Conteo registrado: ${r.resultado === 'SOBRANTE' ? 'sobraban' : 'faltaban'} ${cantidad(
                Math.abs(Number(r.diferencia)),
              )} ${u}. Ahora hay ${nuevo} ${u}.`,
      );
    },
    onError: (e) => setError(e.message),
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    const valor =
      accion === 'conteo'
        ? leerCantidadOCero(cant, producto.unidad)
        : leerCantidad(cant, producto.unidad);
    if (valor === null) {
      return setError(
        producto.unidad === 'UND'
          ? 'Escribe una cantidad entera, por ejemplo 12'
          : 'Escribe la cantidad con hasta 3 decimales, por ejemplo 2.5',
      );
    }
    if (accion === 'conteo' && valor === Number(producto.stock)) {
      return setError(
        `El sistema ya tiene ${cantidad(producto.stock)} ${u}: no hay diferencia que registrar.`,
      );
    }
    if (accion !== 'ingreso' && !motivo.trim())
      return setError('Escribe o elige el motivo');

    if (accion === 'ingreso') {
      const nuevoCosto = costo.trim() ? leerMonto(costo) : undefined;
      const nuevoPrecio = precio.trim() ? leerMonto(precio) : undefined;
      if (nuevoCosto === null || nuevoPrecio === null) {
        return setError(
          'Los precios admiten hasta 2 decimales, por ejemplo 3.80',
        );
      }
      setError(null);
      return registrar.mutate({
        ruta: '/inventario/ingresos',
        cuerpo: {
          items: [
            {
              productoId: producto.id,
              cantidad: valor,
              ...(nuevoCosto !== undefined && { precioCompra: nuevoCosto }),
              ...(nuevoPrecio !== undefined && { precioVenta: nuevoPrecio }),
            },
          ],
          ...(nota.trim() && { nota: nota.trim() }),
        },
      });
    }
    setError(null);
    registrar.mutate(
      accion === 'merma'
        ? {
            ruta: '/inventario/mermas',
            cuerpo: {
              productoId: producto.id,
              cantidad: valor,
              motivo: motivo.trim(),
            },
          }
        : {
            ruta: '/inventario/ajustes',
            cuerpo: {
              productoId: producto.id,
              stockReal: valor,
              motivo: motivo.trim(),
            },
          },
    );
  }

  return (
    <form
      onSubmit={enviar}
      onChange={() => error && setError(null)}
      className="flex flex-col gap-3"
    >
      {accion === 'ingreso' && (
        <>
          <Campo
            etiqueta={`¿Cuántos ${u} llegaron?`}
            id="m-cantidad"
            value={cant}
            onChange={(e) => setCant(e.target.value)}
            inputMode="decimal"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <Campo
              etiqueta="Costo nuevo (S/)"
              id="m-costo"
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
              inputMode="decimal"
              placeholder={Number(producto.precioCompra).toFixed(2)}
            />
            <Campo
              etiqueta="Precio nuevo (S/)"
              id="m-precio"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              inputMode="decimal"
              placeholder={Number(producto.precioVenta).toFixed(2)}
            />
          </div>
          <p className="-mt-1 text-sm text-tinta-suave">
            Deja los precios vacíos si no cambiaron.
          </p>
          <Campo
            etiqueta="Nota (opcional)"
            id="m-nota"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={200}
            placeholder="Ej.: Distribuidora San Martín, boleta B001-123"
          />
        </>
      )}

      {accion === 'merma' && (
        <>
          <Campo
            etiqueta={`¿Cuántos ${u} se pierden?`}
            id="m-cantidad"
            value={cant}
            onChange={(e) => setCant(e.target.value)}
            inputMode="decimal"
            autoFocus
          />
          <Motivo
            motivo={motivo}
            setMotivo={setMotivo}
            opciones={MOTIVOS_MERMA}
          />
        </>
      )}

      {accion === 'conteo' && (
        <>
          <Campo
            etiqueta={`¿Cuántos ${u} hay en el anaquel?`}
            id="m-cantidad"
            value={cant}
            onChange={(e) => setCant(e.target.value)}
            inputMode="decimal"
            autoFocus
            ayuda={`El sistema dice ${cantidad(producto.stock)} ${u}. Se registrará la diferencia.`}
          />
          <Campo
            etiqueta="Motivo"
            id="m-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={200}
          />
        </>
      )}

      {error && <Aviso>{error}</Aviso>}
      <Boton type="submit" disabled={registrar.isPending}>
        {registrar.isPending
          ? 'Registrando…'
          : accion === 'ingreso'
            ? 'Registrar ingreso'
            : accion === 'merma'
              ? 'Registrar merma'
              : 'Registrar conteo'}
      </Boton>
    </form>
  );
}

function Motivo({
  motivo,
  setMotivo,
  opciones,
}: {
  motivo: string;
  setMotivo: (m: string) => void;
  opciones: string[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="m-motivo" className="text-sm font-semibold">
        Motivo
      </label>
      <div className="flex flex-wrap gap-2">
        {opciones.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMotivo(m)}
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
      <input
        id="m-motivo"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        maxLength={200}
        placeholder="O escribe el motivo"
        className="h-11 rounded-lg border border-linea bg-papel px-3 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
      />
    </div>
  );
}
