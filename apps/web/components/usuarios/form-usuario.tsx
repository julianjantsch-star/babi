'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { UserPlus } from 'lucide-react';
import { convidarUsuario } from '@/app/actions/usuarios';
import { Modal } from '@/components/ui/modal';
import { Botao } from '@/components/ui/button';
import { Campo } from '@/components/ui/campos';
import { Aviso } from '@/components/ui/cards';
import { ROLES, type AppRole } from '@/lib/types';
import { cn } from '@/lib/utils';

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" carregando={pending} className="w-full" tamanho="lg">
      {pending ? 'Criando acesso…' : 'Criar e enviar convite'}
    </Botao>
  );
}

export function FormUsuario() {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useFormState(convidarUsuario, undefined);
  const [papel, setPapel] = useState<AppRole>('BALCAO');

  return (
    <>
      <Botao onClick={() => setAberto(true)}>
        <UserPlus className="h-4 w-4" /> Novo usuário
      </Botao>

      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo="Novo usuário">
        <form action={acao} className="space-y-4">
          <input type="hidden" name="role" value={papel} />

          {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
          {estado?.ok && <Aviso tom="sucesso">{estado.ok}</Aviso>}

          <Campo rotulo="Nome completo" name="nome" required autoFocus maxLength={120} />
          <Campo rotulo="E-mail" name="email" type="email" inputMode="email"
            autoCapitalize="none" required
            dica="O convite para definir a senha vai para este endereço." />
          <Campo rotulo="Telefone (opcional)" name="telefone" type="tel" />

          <div>
            <p className="rotulo">Perfil de acesso</p>
            <div className="space-y-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setPapel(r.value)}
                  aria-pressed={papel === r.value}
                  className={cn(
                    'w-full rounded-xl border p-3 text-left transition',
                    papel === r.value
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                      : 'border-slate-200 hover:bg-slate-50',
                  )}
                >
                  <span className="block text-sm font-semibold text-slate-900">
                    {r.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {r.descricao}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <Enviar />
        </form>
      </Modal>
    </>
  );
}
