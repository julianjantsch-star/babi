'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma';
type Tamanho = 'sm' | 'md' | 'lg';

const variantes: Record<Variante, string> = {
  primario: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500',
  secundario:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-400',
  perigo: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500',
  fantasma: 'text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400',
};

const tamanhos: Record<Tamanho, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

export interface BotaoProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
  carregando?: boolean;
}

export const Botao = forwardRef<HTMLButtonElement, BotaoProps>(function Botao(
  { className, variante = 'primario', tamanho = 'md', carregando, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || carregando}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-semibold',
        'transition focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        variantes[variante], tamanhos[tamanho], className,
      )}
      {...props}
    >
      {carregando && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </button>
  );
});
