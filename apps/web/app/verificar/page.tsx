import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MolduraAuth } from '@/components/auth/moldura';
import { FormCodigo } from '@/components/auth/form-codigo';

export const metadata: Metadata = { title: 'Verificação em duas etapas' };

export default async function PaginaVerificar() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <MolduraAuth
      titulo="Verificação em duas etapas"
      subtitulo="Só mais um passo para proteger seus dados"
      rodape={
        <form action="/api/sair" method="post">
          <button type="submit" className="font-medium text-slate-500 hover:underline">
            Entrar com outra conta
          </button>
        </form>
      }
    >
      <FormCodigo email={user.email ?? ''} />
    </MolduraAuth>
  );
}
