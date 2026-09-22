'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Diálogo nativo <dialog>: no desktop aparece centralizado; no celular sobe
 * do rodapé como uma folha, que é o padrão que o polegar alcança.
 */
export function Modal({
  aberto, aoFechar, titulo, children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (aberto && !dialog.open) dialog.showModal();
    if (!aberto && dialog.open) dialog.close();
  }, [aberto]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const cancelar = (e: Event) => { e.preventDefault(); aoFechar(); };
    dialog.addEventListener('cancel', cancelar);
    return () => dialog.removeEventListener('cancel', cancelar);
  }, [aoFechar]);

  return (
    <dialog
      ref={ref}
      aria-label={titulo}
      className="m-0 w-full max-w-lg rounded-t-3xl bg-white p-0 shadow-xl
        backdrop:bg-slate-900/50 sm:m-auto sm:rounded-2xl
        mt-auto sm:mt-auto"
      style={{ maxHeight: '92dvh' }}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          className="grid h-9 w-9 place-items-center rounded-lg text-slate-500
            hover:bg-slate-100"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>
      <div className="overflow-y-auto px-5 py-5" style={{ maxHeight: 'calc(92dvh - 65px)' }}>
        {children}
      </div>
    </dialog>
  );
}
