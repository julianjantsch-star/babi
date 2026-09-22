import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface Base {
  rotulo?: string;
  erro?: string;
  dica?: string;
}

export const Campo = forwardRef<
  HTMLInputElement,
  Base & React.InputHTMLAttributes<HTMLInputElement>
>(function Campo({ rotulo, erro, dica, className, id, ...props }, ref) {
  const idCampo = id ?? props.name;
  return (
    <div>
      {rotulo && <label htmlFor={idCampo} className="rotulo">{rotulo}</label>}
      <input
        ref={ref}
        id={idCampo}
        className={cn('campo', erro && 'border-rose-400 focus:ring-rose-500/20', className)}
        aria-invalid={!!erro}
        {...props}
      />
      {dica && !erro && <p className="mt-1 text-xs text-slate-500">{dica}</p>}
      {erro && <p className="mt-1 text-xs font-medium text-rose-600">{erro}</p>}
    </div>
  );
});

export const Selecao = forwardRef<
  HTMLSelectElement,
  Base & React.SelectHTMLAttributes<HTMLSelectElement>
>(function Selecao({ rotulo, erro, dica, className, id, children, ...props }, ref) {
  const idCampo = id ?? props.name;
  return (
    <div>
      {rotulo && <label htmlFor={idCampo} className="rotulo">{rotulo}</label>}
      <select ref={ref} id={idCampo} className={cn('campo pr-8', className)} {...props}>
        {children}
      </select>
      {dica && !erro && <p className="mt-1 text-xs text-slate-500">{dica}</p>}
      {erro && <p className="mt-1 text-xs font-medium text-rose-600">{erro}</p>}
    </div>
  );
});

export const AreaTexto = forwardRef<
  HTMLTextAreaElement,
  Base & React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function AreaTexto({ rotulo, erro, className, id, ...props }, ref) {
  const idCampo = id ?? props.name;
  return (
    <div>
      {rotulo && <label htmlFor={idCampo} className="rotulo">{rotulo}</label>}
      <textarea ref={ref} id={idCampo} rows={3} className={cn('campo', className)} {...props} />
      {erro && <p className="mt-1 text-xs font-medium text-rose-600">{erro}</p>}
    </div>
  );
});
