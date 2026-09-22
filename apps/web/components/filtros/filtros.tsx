'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { Alternador } from '@/components/ui/alternador';
import { NavegadorMes } from '@/components/filtros/navegador-mes';
import { mesAtual } from '@/lib/filtros';
import { cn } from '@/lib/utils';

export type ValorOrigem = 'TODAS' | 'PF' | 'PJ' | 'CLINICA';
export type ValorTipoPessoa = 'TODOS' | 'PF' | 'PJ';
export type ValorStatus = 'TODOS' | 'PENDENTE' | 'PAGA' | 'VENCIDA';

interface Props {
  mostrarMes?: boolean;
  mostrarStatus?: boolean;
  /** Habilita o botão "Todos os meses" no navegador de período. */
  permitirTodosOsMeses?: boolean;
  /** O perfil Balcão só enxerga a origem Clínica; o seletor some para ele. */
  travadoEmClinica?: boolean;
}

export function Filtros({
  mostrarMes = true,
  mostrarStatus = false,
  permitirTodosOsMeses = false,
  travadoEmClinica = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pendente, iniciar] = useTransition();

  const navegar = useCallback((novos: URLSearchParams) => {
    // Qualquer mudança de filtro volta para a primeira página.
    novos.delete('pagina');
    const query = novos.toString();
    iniciar(() => router.replace(query ? `${pathname}?${query}` : pathname,
      { scroll: false }));
  }, [pathname, router]);

  const definir = useCallback((chave: string, valor: string) => {
    const novos = new URLSearchParams(params.toString());
    if (!valor || valor === 'TODAS' || valor === 'TODOS') novos.delete(chave);
    else novos.set(chave, valor);
    navegar(novos);
  }, [params, navegar]);

  const definirMes = useCallback((mes: string) => {
    const novos = new URLSearchParams(params.toString());
    // O mês corrente é o padrão do servidor; deixá-lo fora mantém a URL curta
    // e faz o link compartilhado sempre abrir no mês de quem recebe.
    if (mes === mesAtual()) novos.delete('mes');
    else novos.set('mes', mes);
    navegar(novos);
  }, [params, navegar]);

  const origem = (params.get('origem') ?? 'TODAS') as ValorOrigem;
  const tipoPessoa = (params.get('pessoa') ?? 'TODOS') as ValorTipoPessoa;
  const status = (params.get('status') ?? 'TODOS') as ValorStatus;
  const mes = params.get('mes') ?? mesAtual();

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

      {mostrarMes && (
        <div>
          <p className="rotulo">Período de vencimento</p>
          <NavegadorMes
            valor={mes}
            aoMudar={definirMes}
            permitirTodos={permitirTodosOsMeses}
            desabilitado={pendente}
          />
        </div>
      )}

      <div className={cn('grid gap-4', mostrarStatus && 'sm:grid-cols-2')}>
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
    </div>
  );
}
