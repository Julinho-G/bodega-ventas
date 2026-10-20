/**
 * Formulario para crear o editar un producto (solo ADMIN).
 * El stock NO se edita aquí: cambia solo con ingresos, ventas, mermas y conteos,
 * para que siempre quede registrado en el kardex.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Aviso, Boton, Campo } from '../componentes/ui';
import { api } from '../lib/api';
import {
  aCentimos,
  leerCantidadOCero,
  leerMonto,
  solesDeCentimos,
} from '../lib/dinero';
import type { Categoria, Producto, Unidad } from '../tipos';

type Props = {
  /** Si viene, se edita; si no, se crea uno nuevo */
  producto?: Producto;
  alGuardar: (producto: Producto) => void;
  alCancelar: () => void;
};

const UNIDADES: { valor: Unidad; texto: string }[] = [
  { valor: 'UND', texto: 'Por unidad' },
  { valor: 'KG', texto: 'Por kilo' },
  { valor: 'LT', texto: 'Por litro' },
];

/** Decimal del backend ("4.5") → texto para el campo ("4.50") */
const aTexto = (valor: string | undefined, decimales: number) =>
  valor === undefined
    ? ''
    : Number(valor)
        .toFixed(decimales)
        .replace(/\.?0+$/, '') || '0';

export default function FormProducto({
  producto,
  alGuardar,
  alCancelar,
}: Props) {
  const queryClient = useQueryClient();
  const editando = producto !== undefined;
  const categorias = useQuery({
    queryKey: ['categorias'],
    queryFn: () => api<Categoria[]>('/categorias'),
  });

  const [nombre, setNombre] = useState(producto?.nombre ?? '');
  const [codigo, setCodigo] = useState(producto?.codigoBarras ?? '');
  const [categoriaId, setCategoriaId] = useState(
    String(producto?.categoriaId ?? ''),
  );
  const [unidad, setUnidad] = useState<Unidad>(producto?.unidad ?? 'UND');
  const [compra, setCompra] = useState(
    producto ? Number(producto.precioCompra).toFixed(2) : '',
  );
  const [venta, setVenta] = useState(
    producto ? Number(producto.precioVenta).toFixed(2) : '',
  );
  const [stockInicial, setStockInicial] = useState('');
  const [stockMinimo, setStockMinimo] = useState(
    aTexto(producto?.stockMinimo, 3),
  );
  const [activo, setActivo] = useState(producto?.activo ?? true);
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: (cuerpo: object) =>
      editando
        ? api<Producto>(`/productos/${producto.id}`, {
            metodo: 'PATCH',
            cuerpo,
          })
        : api<Producto>('/productos', { metodo: 'POST', cuerpo }),
    onSuccess: async (guardado) => {
      // Se espera la recarga antes de avisar: la ficha y el aviso nunca se contradicen
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      await queryClient.invalidateQueries({ queryKey: ['productos'] });
      alGuardar(guardado);
    },
    onError: (e) => setError(e.message),
  });

  // Ganancia por unidad, solo como referencia para el dueño
  const compraNum = leerMonto(compra);
  const ventaNum = leerMonto(venta);
  const ganancia =
    compraNum !== null && ventaNum !== null && ventaNum > 0
      ? aCentimos(ventaNum) - aCentimos(compraNum)
      : null;

  function enviar(e: FormEvent) {
    e.preventDefault();
    const minimo = stockMinimo.trim()
      ? leerCantidadOCero(stockMinimo, unidad)
      : 0;
    const inicial = stockInicial.trim()
      ? leerCantidadOCero(stockInicial, unidad)
      : 0;
    const errorDe = !nombre.trim()
      ? 'Escribe el nombre del producto'
      : codigo.trim() && !/^\d{4,14}$/.test(codigo.trim())
        ? 'El código de barras debe tener entre 4 y 14 dígitos'
        : !categoriaId
          ? 'Elige una categoría'
          : compraNum === null
            ? 'Escribe el costo con hasta 2 decimales, por ejemplo 3.60'
            : ventaNum === null || ventaNum <= 0
              ? 'Escribe el precio de venta, por ejemplo 4.50'
              : ventaNum < compraNum
                ? 'El precio de venta no puede ser menor que el costo'
                : minimo === null || inicial === null
                  ? unidad === 'UND'
                    ? 'Los productos por unidad solo admiten cantidades enteras'
                    : 'Las cantidades admiten hasta 3 decimales'
                  : null;
    if (errorDe) return setError(errorDe);
    setError(null);

    const comun = {
      nombre: nombre.trim(),
      categoriaId: Number(categoriaId),
      unidad,
      precioCompra: compraNum,
      precioVenta: ventaNum,
      stockMinimo: minimo,
    };
    guardar.mutate(
      editando
        ? { ...comun, codigoBarras: codigo.trim() || null, activo }
        : {
            ...comun,
            ...(codigo.trim() && { codigoBarras: codigo.trim() }),
            stockInicial: inicial,
          },
    );
  }

  const nombreUnidad =
    unidad === 'UND' ? 'unidades' : unidad === 'KG' ? 'kilos' : 'litros';

  return (
    <form
      onSubmit={enviar}
      onChange={() => error && setError(null)}
      className="flex flex-col gap-4 rounded-xl border border-linea bg-papel p-5"
    >
      <h2 className="text-lg font-bold">
        {editando ? `Editar ${producto.nombre}` : 'Nuevo producto'}
      </h2>

      <Campo
        etiqueta="Nombre"
        id="p-nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        maxLength={120}
        placeholder="Ej.: Atún Florida 170 g"
        autoFocus={!editando}
      />
      <Campo
        etiqueta="Código de barras (opcional)"
        id="p-codigo"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        inputMode="numeric"
        ayuda="Escanéalo con el lector. Déjalo vacío para productos a granel o sin código."
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="p-categoria" className="text-sm font-semibold">
          Categoría
        </label>
        <select
          id="p-categoria"
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
          className="h-12 rounded-lg border border-linea bg-papel px-3 text-lg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
        >
          <option value="">Elige una categoría</option>
          {categorias.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Se vende</legend>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {UNIDADES.map((u) => (
            <label
              key={u.valor}
              className={`flex h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-tinta ${
                unidad === u.valor
                  ? 'border-tinta bg-tinta text-white'
                  : 'border-linea hover:border-tinta'
              }`}
            >
              <input
                type="radio"
                name="unidad"
                value={u.valor}
                checked={unidad === u.valor}
                onChange={() => setUnidad(u.valor)}
                className="sr-only"
              />
              {u.texto}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Campo
          etiqueta="Costo (S/)"
          id="p-compra"
          value={compra}
          onChange={(e) => setCompra(e.target.value)}
          inputMode="decimal"
          placeholder="3.60"
        />
        <Campo
          etiqueta="Precio de venta (S/)"
          id="p-venta"
          value={venta}
          onChange={(e) => setVenta(e.target.value)}
          inputMode="decimal"
          placeholder="4.50"
        />
      </div>
      {ganancia !== null && (
        <p
          className={`-mt-1 text-sm font-semibold ${ganancia < 0 ? 'text-rojo' : 'text-verde'}`}
        >
          {ganancia < 0
            ? 'El precio de venta es menor que el costo'
            : `Ganas ${solesDeCentimos(ganancia)} por ${unidad === 'UND' ? 'unidad' : unidad === 'KG' ? 'kilo' : 'litro'}${
                ventaNum
                  ? ` (${Math.round((ganancia / aCentimos(ventaNum)) * 100)} % del precio)`
                  : ''
              }`}
        </p>
      )}

      <div className={`grid gap-3 ${editando ? '' : 'grid-cols-2'}`}>
        {!editando && (
          <Campo
            etiqueta={`Stock inicial (${nombreUnidad})`}
            id="p-inicial"
            value={stockInicial}
            onChange={(e) => setStockInicial(e.target.value)}
            inputMode="decimal"
            placeholder="0"
          />
        )}
        <Campo
          etiqueta={`Avisar cuando queden (${nombreUnidad})`}
          id="p-minimo"
          value={stockMinimo}
          onChange={(e) => setStockMinimo(e.target.value)}
          inputMode="decimal"
          placeholder="0"
        />
      </div>

      {editando && (
        <label className="flex items-center gap-3 font-semibold">
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            className="size-5 accent-tinta"
          />
          Se sigue vendiendo
          <span className="font-normal text-tinta-suave">
            (desmárcalo para descontinuarlo)
          </span>
        </label>
      )}
      {editando && (
        <p className="text-sm text-tinta-suave">
          El stock no se cambia aquí: usa “Llegó mercadería”, “Merma” o “Conteo”
          para que quede registrado.
        </p>
      )}

      {error && <Aviso>{error}</Aviso>}
      <div className="flex gap-2">
        <Boton
          type="button"
          variante="secundario"
          onClick={alCancelar}
          className="flex-1"
        >
          Cancelar
        </Boton>
        <Boton type="submit" disabled={guardar.isPending} className="flex-1">
          {guardar.isPending
            ? 'Guardando…'
            : editando
              ? 'Guardar cambios'
              : 'Crear producto'}
        </Boton>
      </div>
    </form>
  );
}
