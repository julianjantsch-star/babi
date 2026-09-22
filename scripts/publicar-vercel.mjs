#!/usr/bin/env node
/**
 * Publica o app na Vercel e alinha o Supabase com a URL de produção.
 *
 * Faz, em ordem:
 *   1. valida o token e identifica a conta
 *   2. cria o projeto (ou reaproveita um existente)
 *   3. envia as variáveis de ambiente lidas de apps/web/.env.local
 *   4. publica em produção pela CLI da Vercel
 *   5. aponta Site URL e redirecionamentos do Supabase para a URL real
 *   6. confere se o site respondeu
 *
 * Uso:
 *   node scripts/publicar-vercel.mjs --token vcp_... --supabase-token sbp_...
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
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
  token: opcoes.token ?? process.env.VERCEL_TOKEN,
  supabaseToken: opcoes['supabase-token'] ?? process.env.SUPABASE_ACCESS_TOKEN,
  nome: opcoes.nome ?? 'babi-financeiro',
};

const cor = (c, t) => `\x1b[${c}m${t}\x1b[0m`;
const passo = (t) => console.log(`\n${cor('1;34', '▸')} ${cor('1', t)}`);
const ok = (t) => console.log(`  ${cor('32', '✓')} ${t}`);
const info = (t) => console.log(`  ${cor('90', '·')} ${t}`);
const alerta = (t) => console.log(`  ${cor('33', '!')} ${t}`);
const falhar = (t) => { console.error(`\n${cor('31', '✗')} ${t}\n`); process.exit(1); };

/** Variáveis que NÃO podem ir para o navegador ficam cifradas na Vercel. */
const SEGREDOS = new Set([
  'SUPABASE_SERVICE_ROLE_KEY', 'AUTH_SECRET',
  'RESEND_API_KEY', 'NFSE_SERVICE_TOKEN',
]);

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
    const msg = corpo?.error?.message ?? JSON.stringify(corpo).slice(0, 300);
    const e = new Error(`${r.status}: ${msg}`);
    e.status = r.status;
    e.corpo = corpo;
    throw e;
  }
  return corpo;
}

// ---------------------------------------------------------------------

/** Lê apps/web/.env.local respeitando aspas e ignorando comentários. */
async function lerEnvLocal() {
  const bruto = await readFile(join(APP, '.env.local'), 'utf8');
  const vars = {};
  for (const linha of bruto.split('\n')) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('#')) continue;
    const igual = limpa.indexOf('=');
    if (igual < 1) continue;
    const chave = limpa.slice(0, igual).trim();
    let valor = limpa.slice(igual + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"'))
      || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    if (valor) vars[chave] = valor;
  }
  return vars;
}

async function identificar() {
  passo('Validando o token da Vercel');
  let dados;
  try {
    dados = await api('/v2/user');
  } catch (e) {
    if (e.status === 401 || e.status === 403) {
      falhar('Token da Vercel inválido ou expirado. Gere outro em '
        + 'https://vercel.com/account/tokens');
    }
    throw e;
  }
  ok(`${dados.user.username} · plano ${dados.user.billing?.plan ?? 'hobby'}`);
  return dados.user;
}

async function obterOuCriarProjeto() {
  passo('Preparando o projeto na Vercel');

  try {
    const existente = await api(`/v9/projects/${cfg.nome}`);
    ok(`Projeto já existe: ${existente.name}`);
    return existente;
  } catch (e) {
    if (e.status !== 404) throw e;
  }

  const criado = await api('/v11/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: cfg.nome,
      framework: 'nextjs',
      // O app vive em apps/web; a raiz do repositório não tem package.json.
      rootDirectory: null,
    }),
  });
  ok(`Projeto criado: ${criado.name}`);
  return criado;
}

async function enviarVariaveis(projeto, vars) {
  passo('Enviando as variáveis de ambiente');

  for (const [chave, valor] of Object.entries(vars)) {
    const cifrada = SEGREDOS.has(chave);
    try {
      await api(`/v10/projects/${projeto.id}/env?upsert=true`, {
        method: 'POST',
        body: JSON.stringify({
          key: chave,
          value: valor,
          type: cifrada ? 'encrypted' : 'plain',
          target: ['production', 'preview', 'development'],
        }),
      });
      ok(`${chave}${cifrada ? ' (cifrada)' : ''}`);
    } catch (e) {
      falhar(`Falha ao enviar ${chave}: ${e.message}`);
    }
  }
}

/** Grava .vercel/project.json para a CLI publicar sem perguntar nada. */
async function vincular(projeto, usuario) {
  await mkdir(join(APP, '.vercel'), { recursive: true });
  await writeFile(
    join(APP, '.vercel', 'project.json'),
    JSON.stringify({ projectId: projeto.id, orgId: usuario.id }, null, 2),
  );
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * O túnel HTTPS desta sessão às vezes cai no meio do upload. Como o proxy já
 * entregou os cabeçalhos, a queda chega como "fetch failed" seco, sem resposta
 * do servidor — indistinguível, à primeira vista, de uma recusa da Vercel.
 * Estes são os sintomas dessa queda, e só eles justificam repetir.
 */
const QUEDA_DE_REDE = [
  'fetch failed', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE',
  'socket hang up', 'network socket disconnected',
];

const pareceQuedaDeRede = (texto) =>
  QUEDA_DE_REDE.some((s) => texto.toLowerCase().includes(s.toLowerCase()));

async function publicar() {
  passo('Publicando em produção');
  info('Isso compila o Next.js na Vercel e pode levar alguns minutos…');

  const TENTATIVAS = 4;

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      const saida = await executar('npx', [
        '--yes', 'vercel@latest', 'deploy',
        '--prod', '--yes', '--token', cfg.token,
      ], { cwd: APP, maxBuffer: 20 * 1024 * 1024, timeout: 15 * 60_000 });

      const url = (saida.stdout.match(/https:\/\/[^\s]+\.vercel\.app/g) ?? []).pop();
      if (!url) falhar(`Não consegui ler a URL publicada:\n${saida.stdout}`);

      ok(`Publicado: ${url}`);
      return url;
    } catch (e) {
      const detalhe = [e.stdout, e.stderr].filter(Boolean).join('\n');

      // Erro real da Vercel (build quebrado, permissão) não melhora repetindo.
      if (!pareceQuedaDeRede(detalhe) || tentativa === TENTATIVAS) {
        falhar(`A publicação falhou:\n\n${detalhe.slice(-3000)}`);
      }

      const segundos = 2 ** tentativa * 3;
      alerta(`Conexão caiu no meio do envio (tentativa ${tentativa}/${TENTATIVAS}).`);
      info(`Repetindo em ${segundos}s…`);
      await espera(segundos * 1000);
    }
  }
}

/** Descobre o domínio estável (…vercel.app) que não muda a cada publicação. */
async function dominioEstavel(projeto) {
  const { domains } = await api(`/v9/projects/${projeto.id}/domains?limit=50`);
  const producao = domains?.find((d) => !d.gitBranch && d.verified);
  return producao ? `https://${producao.name}` : null;
}

async function alinharSupabase(siteUrl) {
  if (!cfg.supabaseToken) {
    alerta('Sem --supabase-token: as URLs do Supabase continuam em localhost.');
    return false;
  }

  passo('Apontando o Supabase para a URL de produção');

  const env = await lerEnvLocal();
  const ref = env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1];
  if (!ref) falhar('Não identifiquei o projeto Supabase pelo .env.local');

  // Mantém localhost na lista para o desenvolvimento continuar funcionando.
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
  ok(`${redirects.length} redirecionamentos liberados (produção + localhost)`);
  return true;
}

async function conferir(url) {
  passo('Conferindo se o site respondeu');

  // Sem sessão, qualquer rota protegida deve mandar para /login.
  const r = await fetch(url, { redirect: 'manual' });
  const destino = r.headers.get('location') ?? '';

  if (r.status >= 500) falhar(`O site respondeu ${r.status}.`);

  if (destino.includes('/login')) {
    ok(`${r.status} → redirecionou para o login, como esperado`);
  } else {
    info(`${r.status} → ${destino || 'sem redirecionamento'}`);
  }

  const login = await fetch(`${url}/login`);
  const html = await login.text();
  if (!login.ok) falhar(`A tela de login respondeu ${login.status}.`);
  if (!html.includes('Financeiro')) {
    alerta('A tela de login carregou, mas sem o conteúdo esperado.');
  } else {
    ok('Tela de login renderizou corretamente');
  }
}

// ---------------------------------------------------------------------

async function principal() {
  if (!cfg.token) {
    falhar('Informe o token: --token vcp_... '
      + '(gere em https://vercel.com/account/tokens)');
  }

  console.log(cor('1', '\n  Publicação na Vercel — Financeiro Odonto'));

  const usuario = await identificar();
  const projeto = await obterOuCriarProjeto();
  await vincular(projeto, usuario);

  const env = await lerEnvLocal();
  // A URL definitiva só existe depois do primeiro deploy; começamos com o
  // domínio previsível do projeto e confirmamos logo em seguida.
  const urlPrevista = `https://${projeto.name}.vercel.app`;
  await enviarVariaveis(projeto, { ...env, NEXT_PUBLIC_SITE_URL: urlPrevista });

  await publicar();

  const estavel = (await dominioEstavel(projeto)) ?? urlPrevista;

  if (estavel !== urlPrevista) {
    info(`Domínio real difere do previsto; corrigindo para ${estavel}`);
    await enviarVariaveis(projeto, { NEXT_PUBLIC_SITE_URL: estavel });
    await publicar();
  }

  await alinharSupabase(estavel);
  await conferir(estavel);

  console.log(`\n${cor('1;32', '━━ No ar ━━')}\n`);
  console.log(`  Endereço:  ${estavel}`);
  console.log(`  Painel:    https://vercel.com/${usuario.username}/${projeto.name}`);
  console.log('');
}

principal().catch((e) => falhar(e.stack ?? e.message));
