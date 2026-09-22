import { cn } from '@/lib/utils';

/**
 * Tabela de verdade só no desktop. Nas telas pequenas as listagens usam
 * cartões empilhados (ver components/parcelas/lista.tsx), porque tabela com
 * rolagem lateral é o que mais atrapalha no celular.
 */
export function Tabela({ children, className }: {
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className, alinhar = 'esquerda' }: {
  children?: React.ReactNode;
  className?: string;
  alinhar?: 'esquerda' | 'direita' | 'centro';
}) {
  return (
    <th className={cn(
      'border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold',
      'uppercase tracking-wide text-slate-500',
      alinhar === 'direita' && 'text-right',
      alinhar === 'centro' && 'text-center',
      alinhar === 'esquerda' && 'text-left',
      className,
    )}>
      {children}
    </th>
  );
}

export function Td({ children, className, alinhar = 'esquerda' }: {
  children?: React.ReactNode;
  className?: string;
  alinhar?: 'esquerda' | 'direita' | 'centro';
}) {
  return (
    <td className={cn(
      'border-b border-slate-100 px-4 py-3 align-middle text-slate-700',
      alinhar === 'direita' && 'text-right tabular-nums',
      alinhar === 'centro' && 'text-center',
      className,
    )}>
      {children}
    </td>
  );
}
