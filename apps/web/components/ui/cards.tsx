import { cn } from '@/lib/utils';
import { moeda } from '@/lib/format';

export function Cartao({ className, children }: {
  className?: string; children: React.ReactNode;
}) {
  return <div className={cn('cartao', className)}>{children}</div>;
}

export function CartaoTitulo({ titulo, acao, descricao }: {
  titulo: string; descricao?: string; acao?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3.5 sm:px-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{titulo}</h2>
        {descricao && <p className="mt-0.5 text-xs text-slate-500">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}

/**
 * Indicador numérico do painel. Em telas pequenas os quatro cartões viram
 * uma grade 2x2 para caber sem rolagem horizontal.
 */
export function Indicador({
  rotulo, valor, detalhe, tom = 'neutro', icone,
}: {
  rotulo: string;
  valor: number | string;
  detalhe?: string;
  tom?: 'neutro' | 'verde' | 'ambar' | 'vermelho' | 'azul';
  icone?: React.ReactNode;
}) {
  const tons = {
    neutro: 'text-slate-900',
    azul: 'text-brand-700',
    verde: 'text-emerald-600',
    ambar: 'text-amber-600',
    vermelho: 'text-rose-600',
  } as const;

  return (
    <div className="cartao p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {rotulo}
        </p>
        {icone && <span className="text-slate-400">{icone}</span>}
      </div>
      <p className={cn(
        'mt-2 text-xl font-bold tabular-nums sm:text-2xl', tons[tom],
      )}>
        {typeof valor === 'number' ? moeda(valor) : valor}
      </p>
      {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
    </div>
  );
}

export function Vazio({ titulo, descricao, acao }: {
  titulo: string; descricao?: string; acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <p className="text-sm font-semibold text-slate-700">{titulo}</p>
      {descricao && <p className="mt-1 max-w-sm text-sm text-slate-500">{descricao}</p>}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}

export function Aviso({ tom = 'info', children }: {
  tom?: 'info' | 'erro' | 'sucesso' | 'alerta';
  children: React.ReactNode;
}) {
  const tons = {
    info: 'bg-brand-50 text-brand-800 border-brand-200',
    erro: 'bg-rose-50 text-rose-800 border-rose-200',
    sucesso: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    alerta: 'bg-amber-50 text-amber-900 border-amber-200',
  } as const;
  return (
    <div role={tom === 'erro' ? 'alert' : 'status'}
      className={cn('rounded-xl border px-4 py-3 text-sm', tons[tom])}>
      {children}
    </div>
  );
}
