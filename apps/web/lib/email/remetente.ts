/**
 * Regras do endereço remetente.
 *
 * Fica separado de resend.ts (que é 'server-only') para poder ser testado
 * isoladamente, sem subir o Next.
 */

/**
 * Domínios de outros projetos que compartilham a mesma conta Resend. Este
 * sistema não pode enviar em nome deles, nem por engano de configuração.
 */
export const DOMINIOS_BLOQUEADOS = ['villabilac.com.br'];

export const REMETENTE_PADRAO = 'Financeiro Odonto <onboarding@resend.dev>';

/** Extrai o domínio de "Nome <caixa@dominio>" ou de "caixa@dominio". */
export function dominioDoRemetente(remetente: string): string | null {
  const endereco = remetente.match(/<([^>]+)>/)?.[1] ?? remetente;
  const dominio = endereco.trim().split('@')[1]?.trim().toLowerCase();
  return dominio && dominio.includes('.') ? dominio : null;
}

/**
 * Lança se o remetente for inválido ou pertencer a um domínio bloqueado.
 * Subdomínios também são barrados: contato.villabilac.com.br não passa.
 */
export function conferirRemetente(remetente: string): void {
  const dominio = dominioDoRemetente(remetente);

  if (!dominio) {
    throw new Error(`EMAIL_FROM inválido: "${remetente}" não tem um endereço de e-mail.`);
  }

  const bloqueado = DOMINIOS_BLOQUEADOS.find(
    (d) => dominio === d || dominio.endsWith(`.${d}`),
  );

  if (bloqueado) {
    throw new Error(
      `O domínio ${bloqueado} pertence a outro projeto e não pode ser usado como `
      + 'remetente deste sistema. Ajuste a variável EMAIL_FROM.',
    );
  }
}
