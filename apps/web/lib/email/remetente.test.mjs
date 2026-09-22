/**
 * Teste da trava de remetente. Roda sem framework:
 *   node --experimental-strip-types lib/email/remetente.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { conferirRemetente, dominioDoRemetente } from './remetente.ts';

test('extrai o domínio dos dois formatos de remetente', () => {
  assert.equal(dominioDoRemetente('Financeiro <fin@exemplo.com.br>'), 'exemplo.com.br');
  assert.equal(dominioDoRemetente('fin@exemplo.com.br'), 'exemplo.com.br');
  assert.equal(dominioDoRemetente('  Fin <FIN@Exemplo.COM.BR>  '), 'exemplo.com.br');
  assert.equal(dominioDoRemetente('sem-arroba'), null);
  assert.equal(dominioDoRemetente('caixa@semponto'), null);
});

test('bloqueia o domínio de outro projeto', () => {
  assert.throws(
    () => conferirRemetente('Financeiro <financeiro@villabilac.com.br>'),
    /pertence a outro projeto/,
  );
});

test('bloqueia subdomínios do domínio de outro projeto', () => {
  assert.throws(
    () => conferirRemetente('a@contato.villabilac.com.br'),
    /pertence a outro projeto/,
  );
  assert.throws(
    () => conferirRemetente('a@NOREPLY.VillaBilac.com.BR'),
    /pertence a outro projeto/,
  );
});

test('não confunde domínio parecido com o bloqueado', () => {
  // "naovillabilac.com.br" termina com o texto, mas não é subdomínio dele.
  assert.doesNotThrow(() => conferirRemetente('a@naovillabilac.com.br'));
});

test('aceita o domínio genérico de testes e um domínio próprio', () => {
  assert.doesNotThrow(() => conferirRemetente('Financeiro <onboarding@resend.dev>'));
  assert.doesNotThrow(() => conferirRemetente('fin@clinicaexemplo.com.br'));
});

test('recusa EMAIL_FROM sem endereço', () => {
  assert.throws(() => conferirRemetente('Financeiro Odonto'), /inválido/);
});
