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
