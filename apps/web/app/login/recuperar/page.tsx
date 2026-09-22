import type { Metadata } from 'next';
import { MolduraAuth } from '@/components/auth/moldura';
import { FormRecuperar } from '@/components/auth/form-recuperar';

export const metadata: Metadata = { title: 'Recuperar senha' };

export default function PaginaRecuperar() {
  return (
    <MolduraAuth
      titulo="Recuperar senha"
      subtitulo="Enviaremos um link para você criar uma nova senha"
    >
      <FormRecuperar />
    </MolduraAuth>
  );
}
