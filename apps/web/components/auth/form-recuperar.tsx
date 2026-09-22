'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { pedirResetSenha } from '@/app/actions/auth';
import { Botao } from '@/components/ui/button';
import { Campo } from '@/components/ui/campos';
import { Aviso } from '@/components/ui/cards';

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" carregando={pending} className="w-full" tamanho="lg">
      {pending ? 'Enviando…' : 'Enviar instruções'}
    </Botao>
  );
}

export function FormRecuperar() {
  const [estado, acao] = useFormState(pedirResetSenha, undefined);
  return (
    <form action={acao} className="space-y-4">
      {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tom="sucesso">{estado.ok}</Aviso>}
      <Campo rotulo="E-mail" name="email" type="email" inputMode="email"
        autoComplete="username" autoCapitalize="none" required autoFocus />
      <Enviar />
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </form>
  );
}
