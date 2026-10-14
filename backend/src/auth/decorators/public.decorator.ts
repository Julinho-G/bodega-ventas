import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca una ruta como pública (no requiere token).
 * Por defecto TODAS las rutas están protegidas; solo se abren con @Public().
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
