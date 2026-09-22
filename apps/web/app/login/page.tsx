import type { Metadata } from 'next';
import { MolduraAuth } from '@/components/auth/moldura';
import { FormLogin } from '@/components/auth/form-login';

export const metadata: Metadata = { title: 'Entrar' };

const MENSAGENS: Record<string, string> = {
  inativo: 'Este acesso foi desativado. Procure o administrador.',
};

export default function PaginaLogin({
  searchParams,
}: { searchParams: { erro?: string } }) {
  return (
    <MolduraAuth
      titulo="Financeiro Odonto"
      subtitulo="Entre para acessar o contas a receber"
      rodape={
        <span>
          Ao entrar, enviaremos um código de verificação para o seu e-mail.
        </span>
      }
    >
      <FormLogin erroInicial={searchParams.erro ? MENSAGENS[searchParams.erro] : undefined} />
    </MolduraAuth>
  );
}
