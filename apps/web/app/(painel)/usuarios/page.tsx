import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { exigirPerfil } from '@/lib/auth/session';
import { data as fdata } from '@/lib/format';
import { ROLES, type Profile } from '@/lib/types';
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { Cartao, CartaoTitulo, Aviso } from '@/components/ui/cards';
import { Etiqueta } from '@/components/ui/badge';
import { FormUsuario } from '@/components/usuarios/form-usuario';
import { AcoesUsuario } from '@/components/usuarios/acoes-usuario';

export const metadata: Metadata = { title: 'Usuários' };
export const dynamic = 'force-dynamic';

export default async function PaginaUsuarios() {
  const eu = await exigirPerfil(['ADMIN']);
  const supabase = createClient();

  const { data } = await supabase
    .from('profiles').select('*').order('nome');
  const usuarios = (data ?? []) as Profile[];

  const rotulo = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

  return (
    <>
      <CabecalhoPagina
        titulo="Usuários"
        descricao="Quem acessa o sistema e com qual permissão"
        acao={<FormUsuario />}
      />

      <div className="space-y-4">
        <Aviso tom="info">
          Todo acesso exige e-mail, senha e o código de verificação enviado por
          e-mail. Ao trocar o perfil de alguém, os dispositivos lembrados dessa
          pessoa são revogados automaticamente.
        </Aviso>

        <Cartao>
          <CartaoTitulo titulo={`${usuarios.length} usuário(s)`} />
          <ul className="divide-y divide-slate-100">
            {usuarios.map((u) => (
              <li key={u.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row
                sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {u.nome}
                    </p>
                    {u.id === eu.id && <Etiqueta tom="azul">Você</Etiqueta>}
                    {!u.ativo && <Etiqueta tom="vermelho">Desativado</Etiqueta>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {u.email} · {rotulo[u.role]} · desde {fdata(u.created_at)}
                  </p>
                </div>
                <AcoesUsuario usuario={u} souEu={u.id === eu.id} />
              </li>
            ))}
          </ul>
        </Cartao>
      </div>
    </>
  );
}
