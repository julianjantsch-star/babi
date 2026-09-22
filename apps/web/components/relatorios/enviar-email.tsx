'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFormState, useFormStatus } from 'react-dom';
import { Mail } from 'lucide-react';
import { enviarRelatorioPorEmail } from '@/app/actions/relatorios';
import { Modal } from '@/components/ui/modal';
import { Botao } from '@/components/ui/button';
import { AreaTexto } from '@/components/ui/campos';
import { Aviso } from '@/components/ui/cards';

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" carregando={pending} className="w-full" tamanho="lg">
      {pending ? 'Enviando…' : 'Enviar relatório'}
    </Botao>
  );
}

export function BotaoEnviarEmail({ emailPadrao }: { emailPadrao: string }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useFormState(enviarRelatorioPorEmail, undefined);
  const params = useSearchParams();

  return (
    <>
      <Botao variante="secundario" onClick={() => setAberto(true)}>
        <Mail className="h-4 w-4" /> Enviar por e-mail
      </Botao>

      <Modal aberto={aberto} aoFechar={() => setAberto(false)}
        titulo="Enviar relatório por e-mail">
        <form action={acao} className="space-y-4">
          {/* Os filtros da tela viajam junto para o relatório bater com o que
              está na frente do usuário. */}
          <input type="hidden" name="mes" value={params.get('mes') ?? ''} />
          <input type="hidden" name="origem" value={params.get('origem') ?? ''} />
          <input type="hidden" name="pessoa" value={params.get('pessoa') ?? ''} />

          {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
          {estado?.ok && <Aviso tom="sucesso">{estado.ok}</Aviso>}

          <AreaTexto
            rotulo="Destinatários"
            name="destinatarios"
            defaultValue={emailPadrao}
            placeholder="contabilidade@escritorio.com, dentista@consultorio.com"
            required
          />
          <p className="-mt-2 text-xs text-slate-500">
            Separe por vírgula. O resumo vai no corpo do e-mail e a planilha
            completa em anexo (CSV).
          </p>

          <Enviar />
        </form>
      </Modal>
    </>
  );
}
