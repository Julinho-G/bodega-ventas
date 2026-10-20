/** Tipos de los datos que devuelve la API (los montos llegan como texto) */

export type Rol = 'ADMIN' | 'CAJERO';

export type Usuario = {
  id: number;
  nombre: string;
  usuario: string;
  rol: Rol;
};

export type MetodoPago = 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA' | 'FIADO';

export type Turno = {
  id: number;
  apertura: string;
  cierre: string | null;
  montoInicial: string;
  montoContado: string | null;
  estado: 'ABIERTO' | 'CERRADO';
};

export type ResumenTurno = {
  montoInicial: string;
  ventasPorMetodo: { metodo: MetodoPago; cantidad: number; total: string }[];
  cantidadVentas: number;
  ventasAnuladas: number;
  totalVendido: string;
  pagosFiadoRecibidos: string;
  efectivoEsperado: string;
};

export type CierreTurno = {
  turno: Turno;
  resumen: ResumenTurno;
  montoContado: string;
  diferencia: string;
};

export type Unidad = 'UND' | 'KG' | 'LT';

export type Producto = {
  id: number;
  codigoBarras: string | null;
  nombre: string;
  unidad: Unidad;
  categoriaId: number;
  precioCompra: string;
  precioVenta: string;
  stock: string;
  stockMinimo: string;
  stockBajo: boolean;
  activo: boolean;
  categoria: { id: number; nombre: string };
};

export type Pagina<T> = {
  datos: T[];
  total: number;
  pagina: number;
  limite: number;
};

export type Cliente = {
  id: number;
  nombre: string;
  dni: string | null;
  telefono: string | null;
  limiteCredito: string;
  deuda: string;
  creditoDisponible: string;
};

export type Venta = {
  id: number;
  fecha: string;
  total: string;
  metodoPago: MetodoPago;
  estado: 'PAGADA' | 'ANULADA';
  /** Solo vienen en la respuesta de POST /ventas */
  montoRecibido?: string | number | null;
  vuelto?: string | null;
  detalles: {
    id: number;
    cantidad: string;
    precioUnitario: string;
    subtotal: string;
    producto: { id: number; nombre: string; unidad: Unidad };
  }[];
};

/** Venta tal como aparece en el listado (sin el detalle de productos) */
export type VentaResumen = {
  id: number;
  fecha: string;
  total: string;
  metodoPago: MetodoPago;
  estado: 'PAGADA' | 'ANULADA';
  cliente: { id: number; nombre: string } | null;
  usuario: { id: number; nombre: string };
  _count: { detalles: number };
};

export type Categoria = {
  id: number;
  nombre: string;
  cantidadProductos: number;
};

export type TipoMovimiento = 'ENTRADA' | 'VENTA' | 'AJUSTE' | 'MERMA';

export type Kardex = {
  producto: { id: number; nombre: string; unidad: Unidad; stockActual: string };
  saldoInicial: string;
  movimientos: {
    id: number;
    fecha: string;
    tipo: TipoMovimiento;
    motivo: string | null;
    ventaId: number | null;
    usuario: { id: number; nombre: string };
    entrada: string;
    salida: string;
    saldo: string;
  }[];
  saldoFinal: string;
  cuadra: boolean;
};

export type EstadoCuenta = {
  cliente: Cliente;
  movimientos: {
    tipo: 'FIADO' | 'PAGO';
    fecha: string;
    ventaId: number | null;
    detalle: string;
    cargo: string;
    abono: string;
    saldo: string;
  }[];
};

/** GET /reportes/resumen */
export type ResumenReporte = {
  periodo: { desde: string; hasta: string };
  cantidadVentas: number;
  totalVendido: string;
  costoDeVentas: string;
  gananciaBruta: string;
  margenPorcentaje: string;
  ticketPromedio: string;
  anuladas: { cantidad: number; monto: string };
  porMetodoPago: { metodo: MetodoPago; ventas: number; total: string }[];
  porDia: { dia: string; ventas: number; total: string; ganancia: string }[];
  porHora: { hora: number; ventas: number; total: string }[];
};

/** GET /reportes/productos */
export type RankingProductos = {
  periodo: { desde: string; hasta: string };
  orden: 'cantidad' | 'importe' | 'ganancia';
  productos: {
    puesto: number;
    id: number;
    nombre: string;
    unidad: Unidad;
    categoria: string;
    ventas: number;
    cantidad: string;
    importe: string;
    ganancia: string;
  }[];
};

/** GET /reportes/inventario */
export type InventarioValorizado = {
  fecha: string;
  categorias: {
    categoria: string;
    productos: number;
    stockBajo: number;
    sinStock: number;
    valorCosto: string;
    valorVenta: string;
    gananciaPotencial: string;
  }[];
  totales: {
    productos: number;
    stockBajo: number;
    sinStock: number;
    valorCosto: string;
    valorVenta: string;
    gananciaPotencial: string;
  };
};
