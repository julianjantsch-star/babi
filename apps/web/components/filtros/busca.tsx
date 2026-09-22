'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useTransition, useEffect } from 'react';
import { Search } from 'lucide-react';

export function CampoBusca({ placeholder = 'Buscar por cliente…' }: {
  placeholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [valor, setValor] = useState(params.get('q') ?? '');
  const [, iniciar] = useTransition();

  // Debounce para não disparar uma query por tecla digitada.
  useEffect(() => {
    const atual = params.get('q') ?? '';
    if (valor === atual) return;

    const id = setTimeout(() => {
      const novos = new URLSearchParams(params.toString());
      if (valor.trim()) novos.set('q', valor.trim());
      else novos.delete('q');
      novos.delete('pagina');
      iniciar(() => router.replace(`${pathname}?${novos.toString()}`, { scroll: false }));
    }, 350);

    return () => clearTimeout(id);
  }, [valor, params, pathname, router]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4
        -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="campo pl-10"
      />
    </div>
  );
}
