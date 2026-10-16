/** Piezas pequeñas de interfaz que se repiten en todas las pantallas */
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';

const foco =
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta';

export function Boton({
  variante = 'principal',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'principal' | 'secundario';
}) {
  const estilos =
    variante === 'principal'
      ? 'bg-tinta text-white hover:bg-[#25335a] disabled:bg-tinta-suave'
      : 'bg-papel text-tinta border border-linea hover:border-tinta';
  return (
    <button
      className={`h-12 rounded-lg px-5 text-base font-semibold transition-colors disabled:cursor-wait ${estilos} ${foco} ${className}`}
      {...props}
    />
  );
}

export function Campo({
  etiqueta,
  id,
  ayuda,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  etiqueta: string;
  id: string;
  ayuda?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {etiqueta}
      </label>
      <input
        id={id}
        className={`h-12 rounded-lg border border-linea bg-papel px-3.5 text-lg placeholder:text-tinta-suave/60 focus:border-tinta ${foco}`}
        {...props}
      />
      {ayuda && <p className="text-sm text-tinta-suave">{ayuda}</p>}
    </div>
  );
}

export function Aviso({
  children,
  tipo = 'error',
}: {
  children: ReactNode;
  tipo?: 'error' | 'ok';
}) {
  const estilos =
    tipo === 'error' ? 'bg-rojo-fondo text-rojo' : 'bg-verde-fondo text-verde';
  return (
    <p
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`rounded-lg px-3.5 py-2.5 text-sm font-medium ${estilos}`}
    >
      {children}
    </p>
  );
}

/**
 * Cartel amarillo con forma de etiqueta de precio, como los de las bodegas.
 * Es el único lugar donde se usa el amarillo: llama la atención sobre el dinero.
 */
export function Etiqueta({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`forma-etiqueta bg-cartulina-borde p-[2px] ${className}`}>
      <div className="forma-etiqueta relative h-full bg-cartulina py-4 pr-6 pl-12">
        {/* agujero del cartel */}
        <span
          aria-hidden
          className="absolute top-1/2 left-5 size-3 -translate-y-1/2 rounded-full bg-pared ring-2 ring-cartulina-borde"
        />
        {children}
      </div>
    </div>
  );
}
