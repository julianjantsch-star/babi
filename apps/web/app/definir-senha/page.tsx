import type { Metadata } from 'next';
import { MolduraAuth } from '@/components/auth/moldura';
import { FormSenha } from '@/components/auth/form-senha';

export const metadata: Metadata = { title: 'Definir senha' };
export const dynamic = 'force-dynamic';

export default function PaginaDefinirSenha() {
  return (
    <MolduraAuth
      titulo="Defina sua senha"
      subtitulo="Escolha uma senha para acessar o sistema"
    >
      <FormSenha />
    </MolduraAuth>
  );
}
