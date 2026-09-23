'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, Receipt, Users, FileText, BarChart3,
  Settings, UserCog, Menu, X, LogOut, FileSignature,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppRole, Profile } from '@/lib/types';

interface Item {
  href: string;
  rotulo: string;
  icone: React.ComponentType<{ className?: string }>;
  papeis: AppRole[];
  /** Aparece na barra inferior do celular. */
  mobile?: boolean;
}

const ITENS: Item[] = [
  { href: '/', rotulo: 'Painel', icone: LayoutDashboard,
    papeis: ['ADMIN', 'FINANCEIRO', 'BALCAO'], mobile: true },
  { href: '/recebiveis', rotulo: 'Contas a receber', icone: Receipt,
    papeis: ['ADMIN', 'FINANCEIRO', 'BALCAO'], mobile: true },
  { href: '/clientes', rotulo: 'Clientes', icone: Users,
    papeis: ['ADMIN', 'FINANCEIRO', 'BALCAO'], mobile: true },
  { href: '/contratos', rotulo: 'Contratos', icone: FileSignature,
    papeis: ['ADMIN', 'FINANCEIRO'], mobile: true },
  { href: '/notas', rotulo: 'Notas fiscais', icone: FileText,
    papeis: ['ADMIN', 'FINANCEIRO'] },
  { href: '/relatorios', rotulo: 'Relatórios', icone: BarChart3,
    papeis: ['ADMIN', 'FINANCEIRO'] },
  { href: '/usuarios', rotulo: 'Usuários', icone: UserCog, papeis: ['ADMIN'] },
  { href: '/configuracoes', rotulo: 'Configurações', icone: Settings, papeis: ['ADMIN'] },
];

const ativo = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href);

export function Navegacao({ perfil }: { perfil: Profile }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const itens = ITENS.filter((i) => i.papeis.includes(perfil.role));
  const itensMobile = itens.filter((i) => i.mobile).slice(0, 4);

  return (
    <>
      {/* ---------------- Desktop: barra lateral fixa ---------------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r
        border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600
            text-sm font-bold text-white">F</span>
          <span className="text-sm font-bold text-slate-900">Financeiro Odonto</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {itens.map((item) => (
            <ItemLink key={item.href} item={item} ativo={ativo(pathname, item.href)} />
          ))}
        </nav>
        <RodapeUsuario perfil={perfil} />
      </aside>

      {/* ---------------- Mobile: topo com menu completo ---------------- */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between
        border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
        <span className="text-sm font-bold text-slate-900">Financeiro Odonto</span>
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          className="grid h-10 w-10 place-items-center rounded-lg text-slate-600
            hover:bg-slate-100"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {aberto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setAberto(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b
              border-slate-200 px-4">
              <span className="text-sm font-semibold">Menu</span>
              <button onClick={() => setAberto(false)} aria-label="Fechar"
                className="grid h-10 w-10 place-items-center rounded-lg
                  text-slate-600 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3"
              onClick={() => setAberto(false)}>
              {itens.map((item) => (
                <ItemLink key={item.href} item={item} ativo={ativo(pathname, item.href)} />
              ))}
            </nav>
            <RodapeUsuario perfil={perfil} />
          </div>
        </div>
      )}

      {/* ------------- Mobile: barra inferior de atalhos ------------- */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid border-t border-slate-200
        bg-white/95 backdrop-blur lg:hidden"
        style={{
          gridTemplateColumns: `repeat(${itensMobile.length}, minmax(0,1fr))`,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
        {itensMobile.map((item) => {
          const on = ativo(pathname, item.href);
          const Icone = item.icone;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1',
                on ? 'text-brand-700' : 'text-slate-500',
              )}
            >
              <Icone className="h-5 w-5" />
              <span className="text-[11px] font-medium leading-tight">
                {item.rotulo.split(' ')[0]}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function ItemLink({ item, ativo: on }: { item: Item; ativo: boolean }) {
  const Icone = item.icone;
  return (
    <Link
      href={item.href}
      aria-current={on ? 'page' : undefined}
      className={cn(
        'flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition',
        on ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
      )}
    >
      <Icone className="h-4.5 w-4.5 shrink-0" />
      {item.rotulo}
    </Link>
  );
}

function RodapeUsuario({ perfil }: { perfil: Profile }) {
  const papel = { ADMIN: 'Administrador', FINANCEIRO: 'Financeiro', BALCAO: 'Balcão' };
  return (
    <div className="border-t border-slate-200 p-3">
      <div className="flex items-center gap-3 rounded-xl px-2 py-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full
          bg-slate-200 text-sm font-semibold text-slate-600">
          {perfil.nome.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{perfil.nome}</p>
          <p className="truncate text-xs text-slate-500">{papel[perfil.role]}</p>
        </div>
      </div>
      <form action="/api/sair" method="post">
        <button type="submit" className="mt-1 flex min-h-[40px] w-full items-center
          gap-3 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-100">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </form>
    </div>
  );
}
