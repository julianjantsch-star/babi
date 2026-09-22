'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { Alternador } from '@/components/ui/alternador';
import { cn } from '@/lib/utils';

export type ValorOrigem = 'TODAS' | 'PF' | 'PJ' | 'CLINICA';
export type ValorTipoPessoa = 'TODOS' | 'PF' | 'PJ';
export type ValorStatus = 'TODOS' | 'PENDENTE' | 'PAGA' | 'VENCIDA';

interface Props {
  mostrarMes?: boolean;
  mostrarStatus?: boolean;
  /** O perfil Balcão só enxerga a origem Clínica; o seletor some para ele. */
  travadoEmClinica?: boolean;
}

export function Filtros({
  mostrarMes = true, mostrarStatus = false, travadoEmClinica = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pendente, iniciar] = useTransition();

  const definir = useCallback((chave: string, valor: string) => {
    const novos = new URLSearchParams(params.toString());
    if (!valor || valor === 'TODAS' || valor === 'TODOS') novos.delete(chave);
    else novos.set(chave, valor);
    // Qualquer mudança de filtro volta para a primeira página.
    novos.delete('pagina');
    iniciar(() => router.replace(`${pathname}?${novos.toString()}`, { scroll: false }));
  }, [params, pathname, router]);

  const origem = (params.get('origem') ?? 'TODAS') as ValorOrigem;
  const tipoPessoa = (params.get('pessoa') ?? 'TODOS') as ValorTipoPessoa;
  const status = (params.get('status') ?? 'TODOS') as ValorStatus;
  const mes = params.get('mes') ?? '';

  return (
    <div className={cn('cartao space-y-4 p-4 sm:p-5', pendente && 'opacity-60')}>
      {!travadoEmClinica && (
        <div>
          <p className="rotulo">Origem do faturamento</p>
          <Alternador<ValorOrigem>
            nome="Origem do faturamento"
            valor={origem}
            aoMudar={(v) => definir('origem', v)}
            opcoes={[
              { value: 'TODAS', label: 'Todas' },
              { value: 'PF', label: 'PF', hint: 'Autônoma' },
              { value: 'PJ', label: 'PJ', hint: 'CNPJ' },
              { value: 'CLINICA', label: 'Clínica', hint: 'Repasse' },
            ]}
            compacto
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="rotulo">Tipo de pagador</p>
          <Alternador<ValorTipoPessoa>
            nome="Tipo de pagador"
            valor={tipoPessoa}
            aoMudar={(v) => definir('pessoa', v)}
            opcoes={[
              { value: 'TODOS', label: 'Todos' },
              { value: 'PF', label: 'Pessoa Física' },
              { value: 'PJ', label: 'Pessoa Jurídica' },
            ]}
            compacto
          />
        </div>

        {mostrarMes && (
          <div>
            <label htmlFor="filtro-mes" className="rotulo">Mês de vencimento</label>
            <input
              id="filtro-mes"
              type="month"
              value={mes}
              onChange={(e) => definir('mes', e.target.value)}
              className="campo"
            />
          </div>
        )}
      </div>

      {mostrarStatus && (
        <div>
          <p className="rotulo">Situação</p>
          <Alternador<ValorStatus>
            nome="Situação"
            valor={status}
            aoMudar={(v) => definir('status', v)}
            opcoes={[
              { value: 'TODOS', label: 'Todas' },
              { value: 'PENDENTE', label: 'Pendentes' },
              { value: 'VENCIDA', label: 'Vencidas' },
              { value: 'PAGA', label: 'Pagas' },
            ]}
            compacto
          />
        </div>
      )}
    </div>
  );
}
