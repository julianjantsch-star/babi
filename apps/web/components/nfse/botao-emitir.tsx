'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { FileText } from 'lucide-react';
import { emitirNotaFiscal } from '@/app/actions/nfse';
import { Modal } from '@/components/ui/modal';
import { Botao } from '@/components/ui/button';
import { Selecao } from '@/components/ui/campos';
import { Aviso } from '@/components/ui/cards';
import { moeda, data as fdata } from '@/lib/format';

function Confirmar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" carregando={pending} className="w-full" tamanho="lg">
      {pending ? 'Transmitindo à SEFIN…' : 'Emitir NFS-e'}
    </Botao>
  );
}

export function BotaoEmitirNota({
  recebivelId, valorTotal, parcelas,
}: {
  recebivelId: string;
  valorTotal: number;
  parcelas: { id: string; numero: number; valor: number; vencimento: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useFormState(emitirNotaFiscal, undefined);

  return (
    <>
      <Botao variante="secundario" onClick={() => setAberto(true)}>
        <FileText className="h-4 w-4" /> Emitir NFS-e
      </Botao>

      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo="Emitir nota fiscal">
        <form action={acao} className="space-y-4">
          <input type="hidden" name="recebivel_id" value={recebivelId} />

          {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
          {estado?.ok && <Aviso tom="sucesso">{estado.ok}</Aviso>}

          <Selecao
            rotulo="O que será faturado"
            name="parcela_id"
            defaultValue=""
            dica="A nota pode cobrir o contrato inteiro ou uma parcela específica."
          >
            <option value="">Contrato completo — {moeda(valorTotal)}</option>
            {parcelas.map((p) => (
              <option key={p.id} value={p.id}>
                Parcela {p.numero} — {moeda(p.valor)} (venc. {fdata(p.vencimento)})
              </option>
            ))}
          </Selecao>

          <Aviso tom="alerta">
            A transmissão é definitiva. Uma nota emitida por engano precisa ser
            cancelada junto à prefeitura, dentro do prazo do município.
          </Aviso>

          <Confirmar />
        </form>
      </Modal>
    </>
  );
}
