import Link from 'next/link';
import { moeda, data as fdata } from '@/lib/format';
import type { ParcelaView } from '@/lib/types';
import { Tabela, Th, Td } from '@/components/ui/tabela';
import { EtiquetaOrigem, EtiquetaStatus } from '@/components/ui/badge';
import { Vazio } from '@/components/ui/cards';
import { BotaoQuitar } from './dialogo-quitar';
import { BotaoEstornar } from './botao-estornar';

const FORMA: Record<string, string> = {
  DINHEIRO: 'Dinheiro', PIX: 'PIX', CARTAO_CREDITO: 'Crédito',
  CARTAO_DEBITO: 'Débito', TRANSFERENCIA: 'Transferência',
  BOLETO: 'Boleto', CHEQUE: 'Cheque', OUTRO: 'Outro',
};

export function ListaParcelas({
  parcelas, podeEstornar,
}: {
  parcelas: ParcelaView[];
  podeEstornar: boolean;
}) {
  if (parcelas.length === 0) {
    return (
      <Vazio
        titulo="Nenhuma parcela encontrada"
        descricao="Ajuste os filtros acima ou lance uma nova conta a receber."
      />
    );
  }

  return (
    <>
      {/* ---------------------- celular: cartões ---------------------- */}
      <ul className="divide-y divide-slate-100 lg:hidden">
        {parcelas.map((p) => (
          <li key={p.id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/recebiveis/${p.recebivel_id}`}
                  className="block truncate text-sm font-semibold text-slate-900">
                  {p.cliente_nome}
                </Link>
                <p className="mt-0.5 truncate text-xs text-slate-500">{p.descricao}</p>
              </div>
              <span className="shrink-0 text-base font-bold tabular-nums text-slate-900">
                {moeda(Number(p.valor))}
              </span>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <EtiquetaStatus status={p.status} vencida={p.vencida} />
              <EtiquetaOrigem origem={p.origem} />
              <span className="text-xs text-slate-500">
                {p.numero}/{p.num_parcelas}
              </span>
            </div>

            <div className="mt-2 text-xs text-slate-500">
              {p.status === 'PAGA' ? (
                <>Pago em {fdata(p.data_pagamento)}
                  {p.forma_pagamento && ` · ${FORMA[p.forma_pagamento]}`}</>
              ) : (
                <>Vence em {fdata(p.vencimento)}</>
              )}
            </div>

            {p.status !== 'CANCELADA' && (
              <div className="mt-3 flex gap-2">
                {p.status === 'PENDENTE'
                  ? <BotaoQuitar parcela={p} />
                  : podeEstornar && <BotaoEstornar parcela={p} />}
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* ---------------------- desktop: tabela ---------------------- */}
      <div className="hidden lg:block">
        <Tabela>
          <thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Descrição</Th>
              <Th>Origem</Th>
              <Th alinhar="centro">Parcela</Th>
              <Th>Vencimento</Th>
              <Th alinhar="direita">Valor</Th>
              <Th>Situação</Th>
              <Th>Quitação</Th>
              <Th alinhar="direita">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {parcelas.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <Td>
                  <Link href={`/recebiveis/${p.recebivel_id}`}
                    className="font-medium text-slate-900 hover:text-brand-700">
                    {p.cliente_nome}
                  </Link>
                </Td>
                <Td className="max-w-xs truncate">{p.descricao}</Td>
                <Td><EtiquetaOrigem origem={p.origem} /></Td>
                <Td alinhar="centro">{p.numero}/{p.num_parcelas}</Td>
                <Td>{fdata(p.vencimento)}</Td>
                <Td alinhar="direita" className="font-semibold text-slate-900">
                  {moeda(Number(p.valor))}
                </Td>
                <Td><EtiquetaStatus status={p.status} vencida={p.vencida} /></Td>
                <Td className="text-xs">
                  {p.status === 'PAGA' ? (
                    <>
                      {fdata(p.data_pagamento)}
                      {p.forma_pagamento && (
                        <span className="block text-slate-400">
                          {FORMA[p.forma_pagamento]}
                        </span>
                      )}
                    </>
                  ) : '—'}
                </Td>
                <Td alinhar="direita">
                  <div className="flex justify-end gap-1">
                    {p.status === 'PENDENTE' && <BotaoQuitar parcela={p} />}
                    {p.status === 'PAGA' && podeEstornar && <BotaoEstornar parcela={p} />}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </div>
    </>
  );
}
