import { exigirPerfil } from '@/lib/auth/session';
import { Navegacao } from '@/components/layout/navegacao';

export default async function LayoutPainel({
  children,
}: { children: React.ReactNode }) {
  const perfil = await exigirPerfil();

  return (
    <div className="min-h-dvh">
      <Navegacao perfil={perfil} />
      {/* lg:pl-60 abre espaço para a barra lateral; pb-20 no mobile evita
          que a barra inferior cubra o último item da lista. */}
      <div className="lg:pl-60">
        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-5 sm:px-6 lg:pb-10 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
