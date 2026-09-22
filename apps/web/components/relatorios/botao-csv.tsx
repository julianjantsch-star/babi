'use client';

import { useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';
import { Botao } from '@/components/ui/button';

export function BotaoCsv() {
  const params = useSearchParams();
  const href = `/api/relatorios/csv?${params.toString()}`;

  return (
    <a href={href} download>
      <Botao variante="secundario" type="button">
        <Download className="h-4 w-4" /> Baixar CSV
      </Botao>
    </a>
  );
}
