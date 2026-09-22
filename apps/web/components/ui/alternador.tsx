'use client';

import { cn } from '@/lib/utils';

export interface OpcaoAlternador<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/**
 * Controle segmentado. Em desktop as opções ficam lado a lado; no celular
 * cada uma ocupa a largura total do seu quadrante para virar alvo de toque
 * confortável (mínimo 44px de altura).
 */
export function Alternador<T extends string>({
  opcoes, valor, aoMudar, nome, compacto = false,
}: {
  opcoes: OpcaoAlternador<T>[];
  valor: T;
  aoMudar: (v: T) => void;
  nome?: string;
  compacto?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={nome}
      className={cn(
        'grid gap-1 rounded-2xl bg-slate-100 p-1',
        opcoes.length === 2 && 'grid-cols-2',
        opcoes.length === 3 && 'grid-cols-3',
        opcoes.length === 4 && 'grid-cols-2 sm:grid-cols-4',
      )}
    >
      {opcoes.map((op) => {
        const ativo = op.value === valor;
        return (
          <button
            key={op.value}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => aoMudar(op.value)}
            className={cn(
              'flex min-h-[44px] flex-col items-center justify-center rounded-xl',
              'px-2 py-2 text-center transition focus-visible:outline-none',
              'focus-visible:ring-2 focus-visible:ring-brand-500',
              ativo
                ? 'bg-white text-brand-700 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900',
            )}
          >
            <span className={cn('text-sm font-semibold leading-tight',
              compacto && 'text-xs sm:text-sm')}>
              {op.label}
            </span>
            {op.hint && !compacto && (
              <span className="mt-0.5 hidden text-[11px] leading-tight text-slate-500 sm:block">
                {op.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
