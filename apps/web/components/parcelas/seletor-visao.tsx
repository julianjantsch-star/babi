'use client';

import { useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { List, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Visao = 'lista' | 'cartoes';

const CHAVE = 'odo:visao-recebiveis';
const PADRAO: Visao = 'lista';

const ler = (): Visao | null => {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === 'lista' || v === 'cartoes' ? v : null;
  } catch {
    // Navegação privada ou armazenamento bloqueado: segue no padrão.
    return null;
  }
};

const gravar = (v: Visao) => {
  try { localStorage.setItem(CHAVE, v); } catch { /* preferência é opcional */ }
};

export function SeletorVisao({ visao }: { visao: Visao }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const naUrl = params.get('visao');

  const aplicar = useCallback((nova: Visao, gravarPreferencia: boolean) => {
    const novos = new URLSearchParams(params.toString());
    // O padrão fica fora da URL, para o endereço não encher de ruído.
    if (nova === PADRAO) novos.delete('visao');
    else novos.set('visao', nova);

    if (gravarPreferencia) gravar(nova);

    const query = novos.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  // Sem escolha na URL, restaura a última preferência deste navegador. Só age
  // quando ela difere do padrão, senão a navegação seria um no-op constante.
  useEffect(() => {
    if (naUrl) return;
    const preferida = ler();
    if (preferida && preferida !== PADRAO) aplicar(preferida, false);
  }, [naUrl, aplicar]);

  const opcoes: { valor: Visao; rotulo: string; Icone: typeof List }[] = [
    { valor: 'lista', rotulo: 'Lista', Icone: List },
    { valor: 'cartoes', rotulo: 'Cartões', Icone: LayoutGrid },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Modo de visualização"
      className="flex shrink-0 gap-1 rounded-xl bg-slate-100 p-1"
    >
      {opcoes.map(({ valor, rotulo, Icone }) => {
        const ativo = valor === visao;
        return (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            title={`Ver como ${rotulo.toLowerCase()}`}
            onClick={() => aplicar(valor, true)}
            className={cn(
              'inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5',
              'text-xs font-semibold transition focus-visible:outline-none',
              'focus-visible:ring-2 focus-visible:ring-brand-500',
              ativo
                ? 'bg-white text-brand-700 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <Icone className="h-4 w-4" />
            <span className="hidden sm:inline">{rotulo}</span>
          </button>
        );
      })}
    </div>
  );
}
