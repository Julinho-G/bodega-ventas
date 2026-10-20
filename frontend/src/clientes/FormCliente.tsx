/**
 * Registrar o editar un cliente. Cualquier usuario puede registrarlo,
 * pero el límite de crédito (cuánto se le puede fiar) solo lo asigna el ADMIN.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Aviso, Boton, Campo } from '../componentes/ui';
import { api } from '../lib/api';
import { leerMonto } from '../lib/dinero';
import { useSesion } from '../sesion/useSesion';
import type { Cliente } from '../tipos';

type Props = {
  cliente?: Cliente;
  alGuardar: (cliente: Cliente) => void;
  alCancelar: () => void;
};

export default function FormCliente({ cliente, alGuardar, alCancelar }: Props) {
  const queryClient = useQueryClient();
  const { usuario } = useSesion();
  const esAdmin = usuario?.rol === 'ADMIN';
  const editando = cliente !== undefined;

  const [nombre, setNombre] = useState(cliente?.nombre ?? '');
  const [dni, setDni] = useState(cliente?.dni ?? '');
  const [telefono, setTelefono] = useState(cliente?.telefono ?? '');
  const [limite, setLimite] = useState(
    cliente ? Number(cliente.limiteCredito).toFixed(2) : '',
  );
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: (cuerpo: object) =>
      editando
        ? api<Cliente>(`/clientes/${cliente.id}`, { metodo: 'PATCH', cuerpo })
        : api<Cliente>('/clientes', { metodo: 'POST', cuerpo }),
    onSuccess: async (guardado) => {
      // Se espera la recarga antes de avisar: la ficha y el aviso nunca se contradicen
      await queryClient.invalidateQueries({ queryKey: ['clientes'] });
      alGuardar(guardado);
    },
    onError: (e) => setError(e.message),
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    const limiteNum = limite.trim() ? leerMonto(limite) : 0;
    const errorDe = !nombre.trim()
      ? 'Escribe el nombre del cliente'
      : dni.trim() && !/^\d{8}$/.test(dni.trim())
        ? 'El DNI debe tener 8 dígitos'
        : telefono.trim() && !/^9\d{8}$/.test(telefono.trim())
          ? 'El celular debe tener 9 dígitos y empezar con 9'
          : limiteNum === null
            ? 'El límite admite hasta 2 decimales, por ejemplo 50 o 50.50'
            : null;
    if (errorDe) return setError(errorDe);
    setError(null);

    const cuerpo = editando
      ? {
          nombre: nombre.trim(),
          // null borra el dato; vacío al crear simplemente no se envía
          dni: dni.trim() || null,
          telefono: telefono.trim() || null,
          ...(esAdmin && { limiteCredito: limiteNum }),
        }
      : {
          nombre: nombre.trim(),
          ...(dni.trim() && { dni: dni.trim() }),
          ...(telefono.trim() && { telefono: telefono.trim() }),
          ...(esAdmin && { limiteCredito: limiteNum }),
        };
    guardar.mutate(cuerpo);
  }

  return (
    <form
      onSubmit={enviar}
      onChange={() => error && setError(null)}
      className="flex flex-col gap-4 rounded-xl border border-linea bg-papel p-5"
    >
      <h2 className="text-lg font-bold">
        {editando ? `Editar ${cliente.nombre}` : 'Nuevo cliente'}
      </h2>
      <Campo
        etiqueta="Nombre"
        id="c-nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        maxLength={120}
        placeholder="Ej.: Señora Rosa Quispe"
        autoFocus={!editando}
      />
      <div className="grid grid-cols-2 gap-3">
        <Campo
          etiqueta="DNI (opcional)"
          id="c-dni"
          value={dni}
          onChange={(e) => setDni(e.target.value)}
          inputMode="numeric"
          maxLength={8}
        />
        <Campo
          etiqueta="Celular (opcional)"
          id="c-telefono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          inputMode="tel"
          maxLength={9}
        />
      </div>
      {esAdmin ? (
        <Campo
          etiqueta="Límite de crédito (S/)"
          id="c-limite"
          value={limite}
          onChange={(e) => setLimite(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          ayuda="Cuánto se le puede fiar como máximo. Con 0 no se le fía."
        />
      ) : (
        <p className="text-sm text-tinta-suave">
          {editando
            ? `Límite de crédito: S/ ${Number(cliente.limiteCredito).toFixed(2)}. Solo el administrador puede cambiarlo.`
            : 'El límite de crédito lo asigna el administrador. Hasta entonces no se le puede fiar.'}
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
              : 'Registrar cliente'}
        </Boton>
      </div>
    </form>
  );
}
