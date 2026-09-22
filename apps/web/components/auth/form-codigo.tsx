'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useState, useTransition } from 'react';
import { verificarCodigo, reenviarCodigo } from '@/app/actions/auth';
import { Botao } from '@/components/ui/button';
import { Aviso } from '@/components/ui/cards';

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" carregando={pending} className="w-full" tamanho="lg">
      {pending ? 'Verificando…' : 'Confirmar acesso'}
    </Botao>
  );
}

export function FormCodigo({ email }: { email: string }) {
  const [estado, acao] = useFormState(verificarCodigo, undefined);
  const [reenvio, setReenvio] = useState<string | null>(null);
  const [pendenteReenvio, iniciarReenvio] = useTransition();

  return (
    <div className="space-y-4">
      {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
      {reenvio && <Aviso tom="sucesso">{reenvio}</Aviso>}

      <p className="text-sm text-slate-600">
        Enviamos um código de 6 dígitos para{' '}
        <strong className="text-slate-900">{email}</strong>.
      </p>

      <form action={acao} className="space-y-4">
        <div>
          <label htmlFor="codigo" className="rotulo">Código de verificação</label>
          <input
            id="codigo"
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoFocus
            placeholder="000000"
            className="campo text-center text-2xl font-bold tracking-[0.4em]"
          />
        </div>

        <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm">
          <input
            type="checkbox"
            name="lembrar"
            defaultChecked
            className="mt-0.5 h-4.5 w-4.5 rounded border-slate-300 text-brand-600
              focus:ring-brand-500"
          />
          <span className="text-slate-600">
            Confiar neste dispositivo por 30 dias
            <span className="block text-xs text-slate-500">
              Não use em computadores compartilhados.
            </span>
          </span>
        </label>

        <Enviar />
      </form>

      <button
        type="button"
        disabled={pendenteReenvio}
        onClick={() => iniciarReenvio(async () => {
          const r = await reenviarCodigo();
          setReenvio(r?.ok ?? r?.erro ?? null);
        })}
        className="w-full text-center text-sm font-medium text-brand-700
          hover:underline disabled:opacity-60"
      >
        {pendenteReenvio ? 'Enviando…' : 'Não recebi o código — reenviar'}
      </button>
    </div>
  );
}
