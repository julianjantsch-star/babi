export function MolduraAuth({
  titulo, subtitulo, children, rodape,
}: {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl
            bg-brand-600 text-lg font-bold text-white">F</span>
          <h1 className="mt-4 text-xl font-bold text-slate-900">{titulo}</h1>
          {subtitulo && (
            <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>
          )}
        </div>
        <div className="cartao p-6">{children}</div>
        {rodape && (
          <div className="mt-5 text-center text-sm text-slate-500">{rodape}</div>
        )}
      </div>
    </main>
  );
}
