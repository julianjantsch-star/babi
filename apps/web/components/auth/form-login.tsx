'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { entrar } from '@/app/actions/auth';
import { Botao } from '@/components/ui/button';
import { Campo } from '@/components/ui/campos';
import { Aviso } from '@/components/ui/cards';

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" carregando={pending} className="w-full" tamanho="lg">
      {pending ? 'Entrando…' : 'Entrar'}
    </Botao>
  );
}

export function FormLogin({ erroInicial }: { erroInicial?: string }) {
  const [estado, acao] = useFormState(entrar, undefined);

  return (
    <form action={acao} className="space-y-4">
      {(estado?.erro || erroInicial) && (
        <Aviso tom="erro">{estado?.erro ?? erroInicial}</Aviso>
      )}

      <Campo
        rotulo="E-mail"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        placeholder="voce@consultorio.com.br"
        required
        autoFocus
      />
      <Campo
        rotulo="Senha"
        name="senha"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        required
      />

      <Enviar />

      <p className="text-center text-sm">
        <Link href="/login/recuperar" className="font-medium text-brand-700 hover:underline">
          Esqueci minha senha
        </Link>
      </p>
    </form>
  );
}
