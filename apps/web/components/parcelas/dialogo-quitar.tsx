'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';
import { quitarParcela } from '@/app/actions/recebiveis';
import { Modal } from '@/components/ui/modal';
import { Botao } from '@/components/ui/button';
import { Campo, Selecao, AreaTexto } from '@/components/ui/campos';
import { Aviso } from '@/components/ui/cards';
import { moeda, data as fdata, hojeISO } from '@/lib/format';
import { FORMAS_PAGAMENTO, type ParcelaView } from '@/lib/types';

function Confirmar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" carregando={pending} className="w-full" tamanho="lg">
      {pending ? 'Registrando…' : 'Confirmar recebimento'}
    </Botao>
  );
}

export function BotaoQuitar({ parcela }: { parcela: ParcelaView }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useFormState(quitarParcela, undefined);

  // Fecha sozinho quando a baixa dá certo.
  if (estado?.ok && aberto) setTimeout(() => setAberto(false), 400);

  return (
    <>
      <Botao variante="secundario" tamanho="sm" onClick={() => setAberto(true)}>
        <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Quitar
      </Botao>

      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo="Registrar recebimento">
        <form action={acao} className="space-y-4">
          <input type="hidden" name="parcela_id" value={parcela.id} />

          {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
          {estado?.ok && <Aviso tom="sucesso">{estado.ok}</Aviso>}

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">{parcela.cliente_nome}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {parcela.descricao} · parcela {parcela.numero}/{parcela.num_parcelas}
            </p>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-xs text-slate-500">
                Vencimento {fdata(parcela.vencimento)}
              </span>
              <span className="text-lg font-bold tabular-nums text-slate-900">
                {moeda(Number(parcela.valor))}
              </span>
            </div>
          </div>

          <Campo
            rotulo="Data do pagamento"
            name="data_pagamento"
            type="date"
            defaultValue={hojeISO()}
            max={hojeISO()}
            required
          />

          <Selecao rotulo="Forma de pagamento" name="forma_pagamento" required defaultValue="PIX">
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </Selecao>

          <AreaTexto rotulo="Observações (opcional)" name="observacoes"
            placeholder="Ex.: pago na recepção, comprovante nº 123" />

          <Confirmar />
        </form>
      </Modal>
    </>
  );
}
