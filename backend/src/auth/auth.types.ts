import { Rol } from '../generated/prisma/client';

/** Datos que viajan dentro del token JWT */
export interface JwtPayload {
  sub: number; // id del usuario
  usuario: string;
  rol: Rol;
}

/** Usuario autenticado que queda disponible en cada petición (request.usuario) */
export interface UsuarioAutenticado {
  id: number;
  nombre: string;
  usuario: string;
  rol: Rol;
}
