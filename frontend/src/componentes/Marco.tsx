/** Marco de las pantallas internas: cabecera con la bodega, el usuario y el botón de salir */
import { LogOut } from 'lucide-react';
import { Navigate, NavLink, Outlet } from 'react-router';
import { useSesion } from '../sesion/useSesion';

const NOMBRE_BODEGA = import.meta.env.VITE_NOMBRE_BODEGA ?? 'Mi Bodega';
const NOMBRE_ROL = { ADMIN: 'Administrador', CAJERO: 'Cajero' } as const;

export default function Marco() {
  const { usuario, estado, salir } = useSesion();

  if (estado === 'verificando') {
    return <p className="p-8 text-tinta-suave">Abriendo tu sesión…</p>;
  }
  if (!usuario) return <Navigate to="/ingresar" replace />;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-linea bg-papel">
        {/* En pantallas angostas: nombre y "Salir" arriba, las secciones en una segunda fila */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <p className="cifra text-2xl">{NOMBRE_BODEGA}</p>
          <nav
            aria-label="Secciones"
            className="order-last -mx-1 flex w-full gap-1 overflow-x-auto px-1 md:order-none md:w-auto"
          >
            <Enlace a="/">Vender</Enlace>
            <Enlace a="/ventas">Ventas</Enlace>
            <Enlace a="/caja">Mi caja</Enlace>
            {usuario.rol === 'ADMIN' && (
              <Enlace a="/productos">Productos</Enlace>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden text-right leading-tight sm:block">
              <p className="font-semibold">{usuario.nombre}</p>
              <p className="text-sm text-tinta-suave">
                {NOMBRE_ROL[usuario.rol]}
              </p>
            </div>
            <button
              onClick={salir}
              className="flex h-10 items-center gap-2 rounded-lg border border-linea px-3 text-sm font-semibold hover:border-tinta focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
            >
              <LogOut aria-hidden className="size-4" />
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

/** Enlace de la cabecera; el de la sección actual queda marcado */
function Enlace({ a, children }: { a: string; children: string }) {
  return (
    <NavLink
      to={a}
      end
      className={({ isActive }) =>
        `rounded-lg px-3 py-2 font-semibold whitespace-nowrap focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta ${
          isActive ? 'bg-tinta text-white' : 'hover:bg-pared'
        }`
      }
    >
      {children}
    </NavLink>
  );
}
