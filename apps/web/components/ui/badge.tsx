import { cn } from '@/lib/utils';
import type { OrigemFaturamento, StatusParcela, NfseStatus } from '@/lib/types';

export function Etiqueta({
  children, className, tom = 'neutro',
}: {
  children: React.ReactNode;
  className?: string;
  tom?: 'neutro' | 'verde' | 'ambar' | 'vermelho' | 'azul' | 'roxo';
}) {
  const tons = {
    neutro: 'bg-slate-100 text-slate-700 ring-slate-200',
    verde: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    ambar: 'bg-amber-50 text-amber-700 ring-amber-200',
    vermelho: 'bg-rose-50 text-rose-700 ring-rose-200',
    azul: 'bg-brand-50 text-brand-700 ring-brand-200',
    roxo: 'bg-violet-50 text-violet-700 ring-violet-200',
  } as const;
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
      'ring-1 ring-inset whitespace-nowrap', tons[tom], className,
    )}>
      {children}
    </span>
  );
}

const rotuloOrigem: Record<OrigemFaturamento, string> = {
  PF: 'Pessoa Física', PJ: 'Pessoa Jurídica', CLINICA: 'Clínica',
};

export function EtiquetaOrigem({ origem }: { origem: OrigemFaturamento }) {
  const tom = origem === 'PJ' ? 'azul' : origem === 'CLINICA' ? 'roxo' : 'neutro';
  return <Etiqueta tom={tom}>{rotuloOrigem[origem]}</Etiqueta>;
}

export function EtiquetaStatus({
  status, vencida,
}: { status: StatusParcela; vencida?: boolean }) {
  if (status === 'PAGA') return <Etiqueta tom="verde">Paga</Etiqueta>;
  if (status === 'CANCELADA') return <Etiqueta tom="neutro">Cancelada</Etiqueta>;
  if (vencida) return <Etiqueta tom="vermelho">Vencida</Etiqueta>;
  return <Etiqueta tom="ambar">Pendente</Etiqueta>;
}

export function EtiquetaNfse({ status }: { status: NfseStatus }) {
  const mapa = {
    AUTORIZADA: ['verde', 'Autorizada'],
    PENDENTE: ['ambar', 'Pendente'],
    PROCESSANDO: ['azul', 'Processando'],
    REJEITADA: ['vermelho', 'Rejeitada'],
    CANCELADA: ['neutro', 'Cancelada'],
  } as const;
  const [tom, rotulo] = mapa[status];
  return <Etiqueta tom={tom}>{rotulo}</Etiqueta>;
}
