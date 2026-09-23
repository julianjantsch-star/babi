#!/usr/bin/env node
/**
 * Liga um domínio próprio ao sistema, do DNS ao remetente dos e-mails.
 *
 * Pré-requisito que não dá para automatizar: o domínio precisa estar
 * registrado (Registro.br, Cloudflare, onde for) e com os nameservers
 * apontados para a Vercel. O resto é feito aqui.
 *
 * Faz, em ordem:
 *   1. confere que o domínio existe e responde no DNS
 *   2. garante o domínio na conta Vercel, com zona de DNS própria
 *   3. publica os registros de e-mail (DKIM, SPF, DMARC) na zona
 *   4. liga o domínio ao projeto, com www redirecionando para a raiz
 *   5. atualiza as variáveis de ambiente e republica o site
 *   6. aponta o Supabase para o novo endereço
 *   7. confere o site no ar e pede a verificação do domínio no Resend
 *
 * Uso:
 *   node scripts/configurar-dominio.mjs \
 *     --dominio financeirodental.com.br \
 *     --token vcp_... --supabase-token sbp_...
 */

import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve as resolverDns, setServers } from 'node:dns/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const executar = promisify(execFile);
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(RAIZ, 'apps', 'web');
const API = 'https://api.vercel.com';

// ---------------------------------------------------------------------

function lerArgumentos(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const chave = argv[i].slice(2);
    const prox = argv[i + 1];
    if (!prox || prox.startsWith('--')) o[chave] = true;
    else { o[chave] = prox; i++; }
  }
  return o;
}

const opcoes = lerArgumentos(process.argv.slice(2));
const cfg = {
  dominio: (opcoes.dominio ?? '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, ''),
  token: opcoes.token ?? process.env.VERCEL_TOKEN,
  supabaseToken: opcoes['supabase-token'] ?? process.env.SUPABASE_ACCESS_TOKEN,
  projeto: opcoes.projeto ?? 'babi-financeiro',
  caixa: opcoes.caixa ?? 'financeiro',
  remetente: opcoes.remetente ?? 'Financeiro Odonto',
  somenteDns: !!opcoes['somente-dns'],
};

const cor = (c, t) => `\x1b[${c}m${t}\x1b[0m`;
const passo = (t) => console.log(`\n${cor('1;34', '▸')} ${cor('1', t)}`);
const ok = (t) => console.log(`  ${cor('32', '✓')} ${t}`);
const info = (t) => console.log(`  ${cor('90', '·')} ${t}`);
const alerta = (t) => console.log(`  ${cor('33', '!')} ${t}`);
const falhar = (t) => { console.error(`\n${cor('31', '✗')} ${t}\n`); process.exit(1); };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const NS_VERCEL = ['ns1.vercel-dns.com', 'ns2.vercel-dns.com'];

async function api(caminho, opts = {}) {
  const r = await fetch(`${API}${caminho}`, {
    ...opts,
    headers: {
      authorization: `Bearer ${cfg.token}`,
      'content-type': 'application/json',
      ...opts.headers,
    },
  });
  const texto = await r.text();
  let corpo;
  try { corpo = texto ? JSON.parse(texto) : null; } catch { corpo = texto; }
  if (!r.ok) {
    const e = new Error(corpo?.error?.message ?? JSON.stringify(corpo).slice(0, 300));
    e.status = r.status;
    e.codigo = corpo?.error?.code;
    throw e;
  }
  return corpo;
}

// ---------------------------------------------------------------------

/**
 * Consulta os servidores raiz públicos em vez do resolvedor local, que pode
 * ter cacheado a ausência do domínio de antes do registro.
 */
async function conferirRegistro() {
  passo('Conferindo o domínio no DNS público');

  setServers(['1.1.1.1', '8.8.8.8']);

  let ns;
  try {
    ns = await resolverDns(cfg.dominio, 'NS');
  } catch (e) {
    if (e.code === 'ENOTFOUND' || e.code === 'NXDOMAIN') {
      falhar(`${cfg.dominio} ainda não existe no DNS.\n`
        + '  Registre o domínio primeiro e aguarde alguns minutos.');
    }
    falhar(`Falha ao consultar o DNS: ${e.message}`);
  }

  const lista = ns.map((n) => n.toLowerCase());
  ok(`Domínio registrado · nameservers: ${lista.join(', ')}`);

  const naVercel = lista.some((n) => n.includes('vercel-dns.com'));
  if (!naVercel) {
    alerta('Os nameservers ainda não são os da Vercel.');
    info(`Configure no registrador: ${NS_VERCEL.join(' e ')}`);
    info('A propagação leva de minutos a algumas horas.');
  }
  return naVercel;
}

async function garantirDominioNaConta() {
  passo('Garantindo o domínio na conta Vercel');

  try {
    const { domain } = await api(`/v5/domains/${cfg.dominio}`);
    ok(`Já estava na conta (serviço: ${domain.serviceType})`);
  } catch (e) {
    if (e.status !== 404) throw e;
    await api('/v5/domains', {
      method: 'POST',
      body: JSON.stringify({ name: cfg.dominio }),
    });
    ok('Domínio adicionado à conta');
  }

  // A zona só existe depois que a Vercel reconhece o domínio; sem ela não há
  // onde publicar os registros de e-mail.
  for (let i = 1; i <= 6; i++) {
    try {
      await api(`/v4/domains/${cfg.dominio}/records?limit=1`);
      ok('Zona de DNS disponível');
      return;
    } catch (e) {
      if (e.codigo !== 'invalid_zone' && e.status !== 400) throw e;
      if (i === 6) {
        falhar(`A Vercel ainda não criou a zona de DNS de ${cfg.dominio}.\n`
          + '  Isso costuma significar que o domínio foi registrado agora e o\n'
          + '  registro ainda não propagou. Tente de novo em alguns minutos.');
      }
      info(`Zona ainda não pronta (tentativa ${i}/6), aguardando…`);
      await espera(15_000);
    }
  }
}

async function publicarRegistrosDeEmail() {
  passo('Publicando os registros de e-mail na zona');

  const arquivo = join(RAIZ, 'scripts', 'dns', `${cfg.dominio}.json`);
  let plano;
  try {
    plano = JSON.parse(await readFile(arquivo, 'utf8'));
  } catch {
    falhar(`Não encontrei o plano de DNS em scripts/dns/${cfg.dominio}.json.\n`
      + '  Ele é gerado ao criar o domínio no Resend.');
  }

  const { records: existentes } = await api(
    `/v4/domains/${cfg.dominio}/records?limit=100`);

  for (const reg of plano.registros) {
    // Idempotente: mesmo nome, tipo e valor não é recriado.
    const igual = (existentes ?? []).find(
      (e) => e.type === reg.type
        && (e.name ?? '') === reg.name
        && (e.value ?? '').trim() === reg.value.trim(),
    );
    if (igual) {
      info(`${reg.type} ${reg.name} — já publicado`);
      continue;
    }

    const corpo = { name: reg.name, type: reg.type, value: reg.value, ttl: 3600 };
    if (reg.mxPriority != null) corpo.mxPriority = reg.mxPriority;

    try {
      await api(`/v2/domains/${cfg.dominio}/records`, {
        method: 'POST',
        body: JSON.stringify(corpo),
      });
      ok(`${reg.type} ${reg.name} — ${reg.descricao}`);
    } catch (e) {
      falhar(`Falha ao publicar ${reg.type} ${reg.name}: ${e.message}`);
    }
  }
}

async function ligarAoProjeto() {
  passo('Ligando o domínio ao site');

  const adicionar = async (nome, extras = {}) => {
    try {
      await api(`/v10/projects/${cfg.projeto}/domains`, {
        method: 'POST',
        body: JSON.stringify({ name: nome, ...extras }),
      });
      ok(`${nome} ligado ao projeto`);
    } catch (e) {
      if (/already in use by this project|already exists/i.test(e.message ?? '')) {
        info(`${nome} — já estava ligado`);
        return;
      }
      throw e;
    }
  };

  await adicionar(cfg.dominio);
  // www existe porque muita gente digita por hábito; redireciona para a raiz.
  await adicionar(`www.${cfg.dominio}`, {
    redirect: cfg.dominio,
    redirectStatusCode: 308,
  });

  const conf = await api(`/v6/domains/${cfg.dominio}/config`);
  if (conf.misconfigured) {
    alerta('A Vercel ainda vê o domínio como mal configurado — '
      + 'normal enquanto os nameservers propagam.');
  } else {
    ok('Domínio configurado corretamente na Vercel');
  }
}

async function lerEnvLocal() {
  const bruto = await readFile(join(APP, '.env.local'), 'utf8');
  const vars = {};
  for (const linha of bruto.split('\n')) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('#')) continue;
    const i = limpa.indexOf('=');
    if (i < 1) continue;
    let v = limpa.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (v) vars[limpa.slice(0, i).trim()] = v;
  }
  return vars;
}

const SEGREDOS = new Set([
  'SUPABASE_SERVICE_ROLE_KEY', 'AUTH_SECRET', 'RESEND_API_KEY', 'NFSE_SERVICE_TOKEN',
]);

async function atualizarAmbiente(siteUrl, emailFrom) {
  passo('Atualizando as variáveis de ambiente');

  const { id } = await api(`/v9/projects/${cfg.projeto}`);

  for (const [chave, valor] of [
    ['NEXT_PUBLIC_SITE_URL', siteUrl],
    ['EMAIL_FROM', emailFrom],
  ]) {
    await api(`/v10/projects/${id}/env?upsert=true`, {
      method: 'POST',
      body: JSON.stringify({
        key: chave,
        value: valor,
        type: SEGREDOS.has(chave) ? 'encrypted' : 'plain',
        target: ['production', 'preview', 'development'],
      }),
    });
    ok(`${chave} = ${valor}`);
  }

  // Mantém o arquivo local em sincronia com a produção.
  const caminho = join(APP, '.env.local');
  let conteudo = await readFile(caminho, 'utf8');
  conteudo = conteudo
    .replace(/^NEXT_PUBLIC_SITE_URL=.*$/m, `NEXT_PUBLIC_SITE_URL=${siteUrl}`)
    .replace(/^EMAIL_FROM=.*$/m, `EMAIL_FROM="${emailFrom}"`);
  await writeFile(caminho, conteudo, { mode: 0o600 });
  ok('apps/web/.env.local sincronizado');
}

const QUEDA_DE_REDE = [
  'fetch failed', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE',
  'socket hang up', 'network socket disconnected',
];

async function republicar() {
  passo('Republicando o site com o novo endereço');
  info('O endereço entra no build, então precisa de uma publicação nova…');

  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    try {
      const saida = await executar('npx', [
        '--yes', 'vercel@latest', 'deploy', '--prod', '--yes', '--token', cfg.token,
      ], { cwd: APP, maxBuffer: 20 * 1024 * 1024, timeout: 15 * 60_000 });
      const url = (saida.stdout.match(/https:\/\/[^\s]+\.vercel\.app/g) ?? []).pop();
      ok(`Publicado${url ? `: ${url}` : ''}`);
      return;
    } catch (e) {
      const detalhe = [e.stdout, e.stderr].filter(Boolean).join('\n');
      const rede = QUEDA_DE_REDE.some((s) => detalhe.toLowerCase().includes(s.toLowerCase()));
      if (!rede || tentativa === 4) falhar(`Publicação falhou:\n\n${detalhe.slice(-2500)}`);
      alerta(`Conexão caiu no envio (tentativa ${tentativa}/4).`);
      await espera(2 ** tentativa * 3000);
    }
  }
}

async function alinharSupabase(siteUrl) {
  if (!cfg.supabaseToken) {
    alerta('Sem --supabase-token: as URLs do Supabase continuam como estavam.');
    return;
  }
  passo('Apontando o Supabase para o novo endereço');

  const env = await lerEnvLocal();
  const ref = env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1];
  if (!ref) falhar('Não identifiquei o projeto Supabase pelo .env.local');

  const redirects = [
    `${siteUrl}/definir-senha`, `${siteUrl}/auth/callback`, `${siteUrl}/**`,
    'http://localhost:3000/definir-senha',
    'http://localhost:3000/auth/callback',
    'http://localhost:3000/**',
  ];

  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${cfg.supabaseToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ site_url: siteUrl, uri_allow_list: redirects.join(',') }),
  });
  if (!r.ok) falhar(`Falha ao ajustar o Supabase: ${await r.text()}`);

  ok(`Site URL: ${siteUrl}`);
  ok(`${redirects.length} redirecionamentos liberados`);
}

async function conferirSite(siteUrl) {
  passo('Conferindo o site no novo endereço');

  for (let i = 1; i <= 10; i++) {
    try {
      const r = await fetch(`${siteUrl}/login`, { redirect: 'manual' });
      if (r.ok) {
        const html = await r.text();
        ok(`${siteUrl}/login respondeu ${r.status}`);
        if (!html.includes('Financeiro')) {
          alerta('A página abriu, mas sem o conteúdo esperado.');
        }
        return true;
      }
      info(`tentativa ${i}/10: HTTP ${r.status}`);
    } catch (e) {
      // Certificado ainda sendo emitido, ou DNS ainda propagando.
      info(`tentativa ${i}/10: ${e.cause?.code ?? e.message}`);
    }
    await espera(15_000);
  }

  alerta('O site ainda não respondeu no domínio novo. '
    + 'Costuma ser propagação de DNS ou emissão do certificado; '
    + 'rode o script de novo mais tarde.');
  return false;
}

// ---------------------------------------------------------------------

async function principal() {
  if (!cfg.dominio) falhar('Informe --dominio exemplo.com.br');
  if (!cfg.token) falhar('Informe --token vcp_... (https://vercel.com/account/tokens)');

  console.log(cor('1', `\n  Configuração de domínio — ${cfg.dominio}`));

  const nsProntos = await conferirRegistro();
  await garantirDominioNaConta();
  await publicarRegistrosDeEmail();
  await ligarAoProjeto();

  if (cfg.somenteDns) {
    console.log(`\n${cor('1;32', '━━ DNS publicado ━━')}\n`);
    return;
  }

  const siteUrl = `https://${cfg.dominio}`;
  const emailFrom = `${cfg.remetente} <${cfg.caixa}@${cfg.dominio}>`;

  await atualizarAmbiente(siteUrl, emailFrom);
  await republicar();
  await alinharSupabase(siteUrl);
  const respondeu = await conferirSite(siteUrl);

  console.log(`\n${cor('1;32', '━━ Domínio configurado ━━')}\n`);
  console.log(`  Site:      ${siteUrl}${respondeu ? '' : '  (ainda propagando)'}`);
  console.log(`  Remetente: ${emailFrom}`);
  if (!nsProntos) {
    console.log(`\n  ${cor('33', 'Falta apontar os nameservers no registrador:')}`);
    console.log(`  ${NS_VERCEL.join('\n  ')}`);
  }
  console.log('\n  Depois disso, peça a verificação do domínio no Resend.\n');
}

principal().catch((e) => falhar(e.stack ?? e.message));
