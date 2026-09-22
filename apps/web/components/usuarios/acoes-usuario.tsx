'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Mail } from 'lucide-react';
import {
  alterarPapel, alternarAtivoUsuario, reenviarConvite,
} from '@/app/actions/usuarios';
import { Botao } from '@/components/ui/button';
import { ROLES, type Profile } from '@/lib/types';

function BotaoSubmit({ children, variante = 'fantasma' }: {
  children: React.ReactNode;
  variante?: 'fantasma' | 'perigo' | 'secundario';
}) {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" tamanho="sm" variante={variante} carregando={pending}>
      {children}
    </Botao>
  );
}

export function AcoesUsuario({ usuario, souEu }: { usuario: Profile; souEu: boolean }) {
  const [, acaoPapel] = useFormState(alterarPapel, undefined);
  const [, acaoAtivo] = useFormState(alternarAtivoUsuario, undefined);
  const [estadoConvite, acaoConvite] = useFormState(reenviarConvite, undefined);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {estadoConvite?.ok && (
        <span className="text-xs text-emerald-600">{estadoConvite.ok}</span>
      )}
      {estadoConvite?.erro && (
        <span className="text-xs text-rose-600">{estadoConvite.erro}</span>
      )}

      <form action={acaoPapel}>
        <input type="hidden" name="id" value={usuario.id} />
        <select
          name="role"
          defaultValue={usuario.role}
          disabled={souEu}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          aria-label={`Perfil de ${usuario.nome}`}
          className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm
            disabled:bg-slate-100 disabled:text-slate-400"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </form>

      <form action={acaoConvite}>
        <input type="hidden" name="email" value={usuario.email} />
        <input type="hidden" name="nome" value={usuario.nome} />
        <input type="hidden" name="role" value={usuario.role} />
        <BotaoSubmit><Mail className="h-4 w-4" /> Reenviar</BotaoSubmit>
      </form>

      {!souEu && (
        <form action={acaoAtivo}>
          <input type="hidden" name="id" value={usuario.id} />
          <input type="hidden" name="ativo" value={String(usuario.ativo)} />
          <BotaoSubmit variante={usuario.ativo ? 'perigo' : 'secundario'}>
            {usuario.ativo ? 'Desativar' : 'Reativar'}
          </BotaoSubmit>
        </form>
      )}
    </div>
  );
}
