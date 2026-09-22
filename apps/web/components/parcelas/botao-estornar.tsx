'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useState } from 'react';
import { Undo2 } from 'lucide-react';
import { estornarParcela } from '@/app/actions/recebiveis';
import { Modal } from '@/components/ui/modal';
import { Botao } from '@/components/ui/button';
import { Aviso } from '@/components/ui/cards';
import { data as fdata, moeda } from '@/lib/format';
import type { ParcelaView } from '@/lib/types';

function Confirmar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" variante="perigo" carregando={pending} className="w-full">
      {pending ? 'Estornando…' : 'Confirmar estorno'}
    </Botao>
  );
}

export function BotaoEstornar({ parcela }: { parcela: ParcelaView }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useFormState(estornarParcela, undefined);

  if (estado?.ok && aberto) setTimeout(() => setAberto(false), 400);

  return (
    <>
      <Botao variante="fantasma" tamanho="sm" onClick={() => setAberto(true)}>
        <Undo2 className="h-4 w-4" /> Estornar
      </Botao>

      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo="Estornar recebimento">
        <form action={acao} className="space-y-4">
          <input type="hidden" name="parcela_id" value={parcela.id} />
          {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}

          <Aviso tom="alerta">
            A parcela de <strong>{moeda(Number(parcela.valor))}</strong>, quitada em{' '}
            <strong>{fdata(parcela.data_pagamento)}</strong>, voltará para pendente.
            O estorno fica registrado na auditoria.
          </Aviso>

          <Confirmar />
        </form>
      </Modal>
    </>
  );
}
