'use client';

import { ChevronLeft, ChevronRight, CalendarRange, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mesExtenso, capitalizar } from '@/lib/format';
import { MES_TODOS, deslocarMes, mesAtual } from '@/lib/filtros';

interface Props {
  /** Mês vigente em YYYY-MM, ou MES_TODOS. */
  valor: string;
  aoMudar: (mes: string) => void;
  /** Exibe o botão "Todos os meses". */
  permitirTodos?: boolean;
  desabilitado?: boolean;
}

const RECUAR = -1;
const AVANCAR = 1;

export function NavegadorMes({
  valor, aoMudar, permitirTodos = false, desabilitado = false,
}: Props) {
  const todos = valor === MES_TODOS;
  const hoje = mesAtual();
  const noMesAtual = valor === hoje;

  const andar = (passo: number) => {
    if (todos) return;
    aoMudar(deslocarMes(valor, passo));
  };

  const setaClasses = cn(
    'grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-300',
    'bg-white text-slate-600 transition hover:bg-slate-50',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
    'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white',
  );

  return (
    <div className={cn('max-w-md space-y-2',
      desabilitado && 'pointer-events-none opacity-60')}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => andar(RECUAR)}
          disabled={todos}
          aria-label="Mês anterior"
          className={setaClasses}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {todos ? (
          <div
            aria-live="polite"
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl
              border border-brand-200 bg-brand-50 px-3 text-sm font-semibold
              text-brand-700"
          >
            <CalendarRange className="h-4 w-4" />
            Todos os meses
          </div>
        ) : (
          <div className="relative flex-1">
            {/* O input nativo carrega o seletor de mês de cada plataforma; a
                legenda por extenso fica logo abaixo, porque o campo mostra
                apenas MM/AAAA. */}
            <input
              type="month"
              aria-label="Mês de vencimento"
              value={valor}
              onChange={(e) => e.target.value && aoMudar(e.target.value)}
              className="campo h-11 text-center font-semibold"
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => andar(AVANCAR)}
          disabled={todos}
          aria-label="Próximo mês"
          className={setaClasses}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {!todos && (
        <p className="text-center text-xs text-slate-500">
          {capitalizar(mesExtenso(`${valor}-01`))}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!noMesAtual && (
          <BotaoAtalho
            ativo={false}
            onClick={() => aoMudar(hoje)}
            icone={<CalendarDays className="h-3.5 w-3.5" />}
          >
            Mês atual
          </BotaoAtalho>
        )}

        {permitirTodos && (
          <BotaoAtalho
            ativo={todos}
            onClick={() => aoMudar(todos ? hoje : MES_TODOS)}
            icone={<CalendarRange className="h-3.5 w-3.5" />}
          >
            {todos ? 'Voltar a um mês' : 'Todos os meses'}
          </BotaoAtalho>
        )}
      </div>
    </div>
  );
}

function BotaoAtalho({
  children, onClick, ativo, icone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ativo: boolean;
  icone: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-xs',
        'font-semibold transition focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-brand-500',
        ativo
          ? 'bg-brand-600 text-white hover:bg-brand-700'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
      )}
    >
      {icone}
      {children}
    </button>
  );
}
