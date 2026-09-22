import Link from 'next/link';
import { moeda, data as fdata } from '@/lib/format';
import type { ParcelaView } from '@/lib/types';
import { Tabela, Th, Td } from '@/components/ui/tabela';
import { EtiquetaOrigem, EtiquetaStatus } from '@/components/ui/badge';
import { Vazio } from '@/components/ui/cards';
import type { Visao } from './seletor-visao';
import { BotaoQuitar } from './dialogo-quitar';
import { BotaoEstornar } from './botao-estornar';

const FORMA: Record<string, string> = {
  DINHEIRO: 'Dinheiro', PIX: 'PIX', CARTAO_CREDITO: 'Crédito',
  CARTAO_DEBITO: 'Débito', TRANSFERENCIA: 'Transferência',
  BOLETO: 'Boleto', CHEQUE: 'Cheque', OUTRO: 'Outro',
};

interface Props {
  parcelas: ParcelaView[];
  podeEstornar: boolean;
  visao?: Visao;
}

/** Botão de ação da parcela, ou nada quando não há ação possível. */
function Acao({ parcela, podeEstornar }: { parcela: ParcelaView; podeEstornar: boolean }) {
  if (parcela.status === 'PENDENTE') return <BotaoQuitar parcela={parcela} />;
  if (parcela.status === 'PAGA' && podeEstornar) return <BotaoEstornar parcela={parcela} />;
  return null;
}

export function ListaParcelas({ parcelas, podeEstornar, visao = 'lista' }: Props) {
  if (parcelas.length === 0) {
    return (
      <Vazio
        titulo="Nenhuma parcela encontrada"
        descricao="Ajuste os filtros acima ou lance uma nova conta a receber."
      />
    );
  }

  if (visao === 'cartoes') {
    return (
      <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-2 xl:grid-cols-3">
        {parcelas.map((p) => (
          <CartaoParcela key={p.id} parcela={p} podeEstornar={podeEstornar} />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Celular: linhas de duas alturas, para caber mais parcela na tela. */}
      <ul className="divide-y divide-slate-100 lg:hidden">
        {parcelas.map((p) => (
          <LinhaCompacta key={p.id} parcela={p} podeEstornar={podeEstornar} />
        ))}
      </ul>

      {/* Desktop: tabela. */}
      <div className="hidden lg:block">
        <TabelaParcelas parcelas={parcelas} podeEstornar={podeEstornar} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------
// Lista compacta (celular)
// ---------------------------------------------------------------------

function LinhaCompacta({
  parcela: p, podeEstornar,
}: { parcela: ParcelaView; podeEstornar: boolean }) {
  return (
    <li className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <Link
          href={`/recebiveis/${p.recebivel_id}`}
          className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900"
        >
          {p.cliente_nome}
        </Link>
        <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
          {moeda(Number(p.valor))}
        </span>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <EtiquetaStatus status={p.status} vencida={p.vencida} />
          {/* A data não pode ser cortada, senão o ano some. A etiqueta ao lado
              já diz se é vencimento ou pagamento, então o rótulo é dispensável
              e o espaço economizado garante a data inteira na tela. */}
          <span
            className="whitespace-nowrap text-xs text-slate-500"
            title={p.status === 'PAGA'
              ? `Pago em ${fdata(p.data_pagamento)}`
              : `Vence em ${fdata(p.vencimento)}`}
          >
            {p.numero}/{p.num_parcelas}
            {' · '}
            {fdata(p.status === 'PAGA' ? p.data_pagamento : p.vencimento)}
          </span>
          <span className="hidden truncate text-xs text-slate-400 md:inline">
            · {p.descricao}
          </span>
        </div>
        <div className="shrink-0">
          <Acao parcela={p} podeEstornar={podeEstornar} />
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------
// Cartão (celular e desktop)
// ---------------------------------------------------------------------

function CartaoParcela({
  parcela: p, podeEstornar,
}: { parcela: ParcelaView; podeEstornar: boolean }) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/recebiveis/${p.recebivel_id}`}
            className="block truncate text-sm font-semibold text-slate-900
              hover:text-brand-700"
          >
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
          <>
            Pago em {fdata(p.data_pagamento)}
            {p.forma_pagamento && ` · ${FORMA[p.forma_pagamento]}`}
          </>
        ) : (
          <>Vence em {fdata(p.vencimento)}</>
        )}
      </div>

      {p.status !== 'CANCELADA' && (
        <div className="mt-3 flex gap-2">
          <Acao parcela={p} podeEstornar={podeEstornar} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Tabela (desktop)
// ---------------------------------------------------------------------

function TabelaParcelas({
  parcelas, podeEstornar,
}: { parcelas: ParcelaView[]; podeEstornar: boolean }) {
  return (
    <Tabela>
      {/* Nove colunas não cabiam e quem ficava de fora era justamente a coluna
          de ações, com o botão de quitar. Duas saíram: a quitação foi recolhida
          para dentro da situação, e a descrição para baixo do nome do cliente.
          Vale lembrar que o espaço útil aqui é ~1152px (max-w-6xl) mesmo em
          telas largas, então breakpoint de janela engana. */}
      <thead>
        <tr>
          <Th>Cliente</Th>
          <Th>Origem</Th>
          <Th alinhar="centro">Parcela</Th>
          <Th>Vencimento</Th>
          <Th alinhar="direita">Valor</Th>
          <Th>Situação</Th>
          <Th alinhar="direita">Ações</Th>
        </tr>
      </thead>
      <tbody>
        {parcelas.map((p) => (
          <tr key={p.id} className="hover:bg-slate-50">
            <Td className="max-w-[16rem]">
              <Link href={`/recebiveis/${p.recebivel_id}`}
                className="block truncate font-medium text-slate-900
                  hover:text-brand-700"
                title={p.cliente_nome}>
                {p.cliente_nome}
              </Link>
              <span className="block truncate text-xs text-slate-400"
                title={p.descricao}>
                {p.descricao}
              </span>
            </Td>
            <Td><EtiquetaOrigem origem={p.origem} /></Td>
            <Td alinhar="centro" className="whitespace-nowrap">
              {p.numero}/{p.num_parcelas}
            </Td>
            <Td className="whitespace-nowrap">{fdata(p.vencimento)}</Td>
            <Td alinhar="direita" className="whitespace-nowrap font-semibold text-slate-900">
              {moeda(Number(p.valor))}
            </Td>
            <Td>
              <EtiquetaStatus status={p.status} vencida={p.vencida} />
              {p.status === 'PAGA' && (
                <span className="mt-1 block whitespace-nowrap text-xs text-slate-400">
                  {fdata(p.data_pagamento)}
                  {p.forma_pagamento && ` · ${FORMA[p.forma_pagamento]}`}
                </span>
              )}
            </Td>
            <Td alinhar="direita">
              <div className="flex justify-end gap-1">
                <Acao parcela={p} podeEstornar={podeEstornar} />
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Tabela>
  );
}
