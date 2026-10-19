/**
 * Carrito de la venta en curso.
 * La cantidad se guarda como TEXTO tal como la escribe el cajero ("0,25"),
 * y se valida con leerCantidad() antes de cobrar.
 */
import { useReducer } from 'react';
import { leerCantidad, subtotalCentimos } from '../lib/dinero';
import type { Producto } from '../tipos';

export type Linea = { producto: Producto; cantidad: string };

type Accion =
  | { tipo: 'agregar'; producto: Producto; cantidad: number | null }
  | { tipo: 'cambiar'; productoId: number; cantidad: string }
  | { tipo: 'quitar'; productoId: number }
  | { tipo: 'vaciar' };

/** Muestra un número sin ceros sobrantes: 2 → "2", 0.25 → "0.25" */
const texto = (n: number) => String(Math.round(n * 1000) / 1000);

function reducir(lineas: Linea[], accion: Accion): Linea[] {
  switch (accion.tipo) {
    case 'agregar': {
      const existente = lineas.find(
        (l) => l.producto.id === accion.producto.id,
      );
      // Por unidad se suma 1 por defecto; a granel se deja vacío para escribir el peso
      const porDefecto = accion.producto.unidad === 'UND' ? 1 : null;
      const sumar = accion.cantidad ?? porDefecto;
      if (existente) {
        // El backend no acepta el mismo producto en dos líneas: se suma a la existente
        const actual =
          leerCantidad(existente.cantidad, existente.producto.unidad) ?? 0;
        return lineas.map((l) =>
          l === existente
            ? {
                ...l,
                cantidad: sumar === null ? l.cantidad : texto(actual + sumar),
              }
            : l,
        );
      }
      return [
        ...lineas,
        {
          producto: accion.producto,
          cantidad: sumar === null ? '' : texto(sumar),
        },
      ];
    }
    case 'cambiar':
      return lineas.map((l) =>
        l.producto.id === accion.productoId
          ? { ...l, cantidad: accion.cantidad }
          : l,
      );
    case 'quitar':
      return lineas.filter((l) => l.producto.id !== accion.productoId);
    case 'vaciar':
      return [];
  }
}

export function useCarrito() {
  const [lineas, despachar] = useReducer(reducir, []);

  const detalle = lineas.map((l) => {
    const cantidad = leerCantidad(l.cantidad, l.producto.unidad);
    return {
      ...l,
      cantidadValida: cantidad,
      subtotal:
        cantidad === null
          ? 0
          : subtotalCentimos(l.producto.precioVenta, cantidad),
    };
  });

  return {
    lineas: detalle,
    totalCentimos: detalle.reduce((acc, l) => acc + l.subtotal, 0),
    /** true si todas las cantidades están bien escritas */
    completo:
      detalle.length > 0 && detalle.every((l) => l.cantidadValida !== null),
    agregar: (producto: Producto, cantidad: number | null = null) =>
      despachar({ tipo: 'agregar', producto, cantidad }),
    cambiar: (productoId: number, cantidad: string) =>
      despachar({ tipo: 'cambiar', productoId, cantidad }),
    quitar: (productoId: number) => despachar({ tipo: 'quitar', productoId }),
    vaciar: () => despachar({ tipo: 'vaciar' }),
  };
}

export type Carrito = ReturnType<typeof useCarrito>;
