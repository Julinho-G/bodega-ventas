/** Pantalla de ingreso: usuario y contraseña */
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { Aviso, Boton, Campo, Etiqueta } from '../componentes/ui';
import { ErrorApi } from '../lib/api';
import { useSesion } from '../sesion/useSesion';

const NOMBRE_BODEGA = import.meta.env.VITE_NOMBRE_BODEGA ?? 'Mi Bodega';

export default function Ingreso() {
  const { usuario, ingresar } = useSesion();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to="/" replace />;

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setError(null);
    setEnviando(true);
    try {
      await ingresar(
        String(datos.get('usuario')),
        String(datos.get('password')),
      );
    } catch (err) {
      setError(
        err instanceof ErrorApi
          ? err.message
          : 'No se pudo ingresar. Intenta de nuevo.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Etiqueta className="mb-6 -rotate-1">
          <h1 className="cifra text-4xl leading-none">{NOMBRE_BODEGA}</h1>
          <p className="mt-1.5 font-medium">Caja y ventas</p>
        </Etiqueta>

        <form
          onSubmit={enviar}
          className="flex flex-col gap-4 rounded-xl border border-linea bg-papel p-6"
        >
          <Campo
            etiqueta="Usuario"
            id="usuario"
            name="usuario"
            autoComplete="username"
            autoCapitalize="none"
            required
            autoFocus
          />
          <Campo
            etiqueta="Contraseña"
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          {error && <Aviso>{error}</Aviso>}
          <Boton type="submit" disabled={enviando} className="mt-1">
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </Boton>
        </form>

        <p className="mt-4 px-1 text-sm text-tinta-suave">
          ¿Olvidaste tu contraseña? Pídele al administrador que te asigne una
          nueva.
        </p>
      </div>
    </main>
  );
}
