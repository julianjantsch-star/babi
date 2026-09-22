'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { definirSenha } from '@/app/actions/auth';
import { createClient } from '@/lib/supabase/client';
import { Botao } from '@/components/ui/button';
import { Campo } from '@/components/ui/campos';
import { Aviso } from '@/components/ui/cards';

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" carregando={pending} className="w-full" tamanho="lg">
      {pending ? 'Salvando…' : 'Salvar senha e entrar'}
    </Botao>
  );
}

export function FormSenha() {
  const [estado, acao] = useFormState(definirSenha, undefined);
  const [pronto, setPronto] = useState(false);
  const [erroLink, setErroLink] = useState<string | null>(null);

  // O link de recuperação do Supabase chega com os tokens no fragmento da
  // URL (fluxo implícito) ou como ?code= (PKCE). Os dois são tratados aqui,
  // antes de liberar o formulário.
  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const access_token = hash.get('access_token');
      const refresh_token = hash.get('refresh_token');
      const code = new URLSearchParams(window.location.search).get('code');

      try {
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
          window.history.replaceState(null, '', window.location.pathname);
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          window.history.replaceState(null, '', window.location.pathname);
        } else {
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            setErroLink('Link inválido ou expirado. Peça um novo ao administrador.');
            return;
          }
        }
        setPronto(true);
      } catch {
        setErroLink('Link inválido ou expirado. Peça um novo ao administrador.');
      }
    })();
  }, []);

  if (erroLink) return <Aviso tom="erro">{erroLink}</Aviso>;
  if (!pronto) return <p className="text-sm text-slate-500">Validando seu link…</p>;

  return (
    <form action={acao} className="space-y-4">
      {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
      <Campo
        rotulo="Nova senha"
        name="senha"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        autoFocus
        dica="Mínimo de 8 caracteres."
      />
      <Campo
        rotulo="Confirme a senha"
        name="confirmacao"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <Enviar />
    </form>
  );
}
