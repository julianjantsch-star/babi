#!/usr/bin/env node
/**
 * Configura o projeto Supabase de ponta a ponta, sem passar pelo painel.
 *
 * Faz, em ordem:
 *   1. valida o token de acesso e localiza a organização
 *   2. cria o projeto (ou usa um existente) na região de São Paulo
 *   3. espera o banco ficar saudável
 *   4. aplica as migrations de supabase/migrations, com controle de versão
 *   5. lê as chaves anon e service_role
 *   6. configura o Auth: cadastro fechado, URLs de redirecionamento, SMTP
 *   7. cria o primeiro administrador e envia o convite
 *   8. grava apps/web/.env.local pronto para uso
 *
 * Uso:
 *   node scripts/configurar-supabase.mjs --token sbp_... --admin-email x@y.com
 *
 * Só precisa de Node 20+. Sem dependências.
 */

import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.supabase.com/v1';

// ---------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------

function lerArgumentos(argv) {
  const opcoes = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const chave = arg.slice(2);
    const proximo = argv[i + 1];
    if (!proximo || proximo.startsWith('--')) {
      opcoes[chave] = true;
    } else {
      opcoes[chave] = proximo;
      i++;
    }
  }
  return opcoes;
}

const opcoes = lerArgumentos(process.argv.slice(2));

const cfg = {
  token: opcoes.token ?? process.env.SUPABASE_ACCESS_TOKEN,
  projetoRef: opcoes.projeto ?? process.env.SUPABASE_PROJECT_REF,
  nomeProjeto: opcoes.nome ?? 'odonto-financeiro',
  regiao: opcoes.regiao ?? 'sa-east-1',
  adminEmail: opcoes['admin-email'],
  adminNome: opcoes['admin-nome'] ?? 'Administrador',
  siteUrl: (opcoes['site-url'] ?? 'http://localhost:3000').replace(/\/$/, ''),
  resendKey: opcoes['resend-key'] ?? process.env.RESEND_API_KEY,
  emailFrom: opcoes['email-from'],
  seed: !!opcoes.seed,
  somenteVerificar: !!opcoes.verificar,
};

// ---------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------

const cor = (c, t) => `\x1b[${c}m${t}\x1b[0m`;
const passo = (t) => console.log(`\n${cor('1;34', '▸')} ${cor('1', t)}`);
const ok = (t) => console.log(`  ${cor('32', '✓')} ${t}`);
const info = (t) => console.log(`  ${cor('90', '·')} ${t}`);
const alerta = (t) => console.log(`  ${cor('33', '!')} ${t}`);
const falhar = (t) => { console.error(`\n${cor('31', '✗')} ${t}\n`); process.exit(1); };

/** Mostra só o começo de um segredo, para conferência sem vazamento. */
const mascarar = (s) => (s ? `${String(s).slice(0, 8)}…${String(s).slice(-4)}` : '—');

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------
// Cliente da Management API
// ---------------------------------------------------------------------

async function api(caminho, opts = {}) {
  const resposta = await fetch(`${API}${caminho}`, {
    ...opts,
    headers: {
      authorization: `Bearer ${cfg.token}`,
      'content-type': 'application/json',
      ...opts.headers,
    },
  });

  const texto = await resposta.text();
  let corpo;
  try { corpo = texto ? JSON.parse(texto) : null; } catch { corpo = texto; }

  if (!resposta.ok) {
    const detalhe = typeof corpo === 'object' && corpo
      ? (corpo.message ?? corpo.msg ?? JSON.stringify(corpo))
      : String(corpo).slice(0, 300);
    const erro = new Error(`${resposta.status} em ${caminho}: ${detalhe}`);
    erro.status = resposta.status;
    throw erro;
  }

  return corpo;
}

/** Executa SQL no banco do projeto pela Management API. */
const executarSql = (ref, query) =>
  api(`/projects/${ref}/database/query`, {
    method: 'POST',
    body: JSON.stringify({ query }),
  });

// ---------------------------------------------------------------------
// Etapas
// ---------------------------------------------------------------------

async function validarToken() {
  passo('Validando o token de acesso');
  let orgs;
  try {
    orgs = await api('/organizations');
  } catch (e) {
    if (e.status === 401) {
      falhar('Token inválido ou expirado. Gere um novo em '
        + 'https://supabase.com/dashboard/account/tokens');
    }
    throw e;
  }

  if (!Array.isArray(orgs) || orgs.length === 0) {
    falhar('Nenhuma organização encontrada nesta conta Supabase.');
  }

  ok(`Token válido · ${orgs.length} organização(ões)`);
  for (const o of orgs) info(`${o.name} (${o.id})`);
  return orgs[0];
}

async function obterOuCriarProjeto(org) {
  passo('Localizando o projeto');

  const projetos = await api('/projects');

  if (cfg.projetoRef) {
    const achado = projetos.find((p) => p.id === cfg.projetoRef);
    if (!achado) falhar(`Projeto ${cfg.projetoRef} não encontrado nesta conta.`);
    ok(`Usando projeto existente: ${achado.name} (${achado.id})`);
    return { projeto: achado, senhaBanco: null };
  }

  const existente = projetos.find((p) => p.name === cfg.nomeProjeto);
  if (existente) {
    ok(`Projeto já existe: ${existente.name} (${existente.id})`);
    return { projeto: existente, senhaBanco: null };
  }

  // Senha forte do banco. Só é exibida aqui; guarde-a no gerenciador de senhas.
  const senhaBanco = randomBytes(24).toString('base64url');

  info(`Criando "${cfg.nomeProjeto}" na região ${cfg.regiao}…`);
  const criado = await api('/projects', {
    method: 'POST',
    body: JSON.stringify({
      organization_id: org.id,
      name: cfg.nomeProjeto,
      region: cfg.regiao,
      db_pass: senhaBanco,
    }),
  });

  ok(`Projeto criado: ${criado.id}`);
  return { projeto: criado, senhaBanco };
}

async function esperarProjetoPronto(ref) {
  passo('Aguardando o banco ficar disponível');
  const limite = Date.now() + 12 * 60_000;
  let ultimoStatus = '';

  while (Date.now() < limite) {
    const p = await api(`/projects/${ref}`);
    if (p.status !== ultimoStatus) {
      info(`status: ${p.status}`);
      ultimoStatus = p.status;
    }
    if (p.status === 'ACTIVE_HEALTHY') {
      ok('Banco pronto');
      return p;
    }
    if (p.status === 'INACTIVE') {
      falhar('O projeto está pausado. Reative-o e rode o script de novo.');
    }
    await esperar(10_000);
  }
  falhar('O projeto não ficou pronto em 12 minutos. Rode o script de novo.');
}

/** Tabela própria de controle: evita reaplicar migration já executada. */
const SQL_CONTROLE = `
create table if not exists public.schema_migracoes (
  versao      text primary key,
  aplicada_em timestamptz not null default now()
);`;

async function aplicarMigrations(ref) {
  passo('Aplicando as migrations no banco');

  await executarSql(ref, SQL_CONTROLE);

  const dir = join(RAIZ, 'supabase', 'migrations');
  const arquivos = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  const aplicadas = await executarSql(ref, 'select versao from public.schema_migracoes');
  const jaAplicadas = new Set((aplicadas ?? []).map((r) => r.versao));

  let executadas = 0;
  for (const arquivo of arquivos) {
    if (jaAplicadas.has(arquivo)) {
      info(`${arquivo} — já aplicada`);
      continue;
    }

    const sql = await readFile(join(dir, arquivo), 'utf8');
    try {
      await executarSql(ref, sql);
    } catch (e) {
      falhar(`Falha em ${arquivo}\n\n${e.message}`);
    }

    await executarSql(
      ref,
      `insert into public.schema_migracoes (versao) values ('${arquivo}')
       on conflict (versao) do nothing`,
    );
    ok(`${arquivo}`);
    executadas++;
  }

  if (executadas === 0) info('Nenhuma migration nova — o schema já estava atualizado.');

  // Conferência: as tabelas e policies principais existem mesmo?
  const conferencia = await executarSql(ref, `
    select
      (select count(*) from information_schema.tables
        where table_schema = 'public'
          and table_name in ('profiles','clientes','recebiveis','parcelas',
                             'notas_fiscais','configuracoes')) as tabelas,
      (select count(*) from pg_policies where schemaname = 'public') as policies,
      (select count(*) from information_schema.views
        where table_schema = 'public' and table_name like 'vw_%') as views
  `);

  const { tabelas, policies, views } = conferencia[0];
  if (Number(tabelas) < 6) falhar(`Só ${tabelas} de 6 tabelas foram criadas.`);
  ok(`Verificado: ${tabelas} tabelas, ${views} views, ${policies} policies de RLS`);
}

async function obterChaves(ref) {
  passo('Lendo as chaves de API do projeto');

  const chaves = await api(`/projects/${ref}/api-keys?reveal=true`);
  const pegar = (nome) => chaves.find((k) => k.name === nome)?.api_key;

  const anon = pegar('anon');
  const service = pegar('service_role');

  if (!anon || !service) {
    falhar('Não foi possível ler as chaves anon/service_role do projeto.');
  }

  ok(`anon: ${mascarar(anon)}`);
  ok(`service_role: ${mascarar(service)} (secreta)`);
  return { anon, service };
}

async function configurarAuth(ref) {
  passo('Configurando a autenticação');

  const redirects = [
    `${cfg.siteUrl}/definir-senha`,
    `${cfg.siteUrl}/auth/callback`,
    `${cfg.siteUrl}/**`,
  ];

  const corpo = {
    // Ninguém se cadastra sozinho: só entra quem o admin convidar.
    disable_signup: true,
    site_url: cfg.siteUrl,
    uri_allow_list: redirects.join(','),
    jwt_exp: 3600,
    refresh_token_rotation_enabled: true,
    password_min_length: 8,
    // O convite já chega confirmado; a posse do e-mail é provada pelo link.
    mailer_autoconfirm: true,
    mailer_secure_email_change_enabled: true,
  };

  // O SMTP do Resend substitui o do Supabase, que no plano gratuito
  // entrega cerca de 2 e-mails por hora — insuficiente para 2FA.
  if (cfg.resendKey) {
    const remetente = (cfg.emailFrom ?? '').match(/<(.+?)>/)?.[1]
      ?? cfg.emailFrom
      ?? 'onboarding@resend.dev';
    Object.assign(corpo, {
      smtp_host: 'smtp.resend.com',
      smtp_port: '465',
      smtp_user: 'resend',
      smtp_pass: cfg.resendKey,
      smtp_admin_email: remetente,
      smtp_sender_name: 'Financeiro Odonto',
      rate_limit_email_sent: 100,
    });
  }

  await api(`/projects/${ref}/config/auth`, {
    method: 'PATCH',
    body: JSON.stringify(corpo),
  });

  ok('Cadastro aberto desativado (só por convite)');
  ok(`Site URL: ${cfg.siteUrl}`);
  ok(`Redirecionamentos liberados: ${redirects.length}`);
  if (cfg.resendKey) ok('SMTP do Resend configurado');
  else alerta('Sem chave do Resend — o SMTP nativo do Supabase limita ~2 e-mails/hora');
}

async function criarAdministrador(ref, chaveService) {
  if (!cfg.adminEmail) {
    alerta('Nenhum --admin-email informado; o primeiro admin não foi criado.');
    return null;
  }

  passo('Criando o primeiro administrador');

  const urlProjeto = `https://${ref}.supabase.co`;
  const cabecalhos = {
    apikey: chaveService,
    authorization: `Bearer ${chaveService}`,
    'content-type': 'application/json',
  };

  // Idempotente: se o usuário já existe, apenas garante o papel ADMIN.
  const busca = await fetch(
    `${urlProjeto}/auth/v1/admin/users?filter=${encodeURIComponent(cfg.adminEmail)}`,
    { headers: cabecalhos },
  );
  const encontrados = busca.ok ? (await busca.json()).users ?? [] : [];
  let usuario = encontrados.find((u) => u.email?.toLowerCase() === cfg.adminEmail.toLowerCase());

  if (usuario) {
    info('Usuário já existia; garantindo o papel de administrador.');
  } else {
    const criacao = await fetch(`${urlProjeto}/auth/v1/admin/users`, {
      method: 'POST',
      headers: cabecalhos,
      body: JSON.stringify({
        email: cfg.adminEmail,
        email_confirm: true,
        user_metadata: { nome: cfg.adminNome, role: 'ADMIN' },
      }),
    });

    if (!criacao.ok) {
      falhar(`Não foi possível criar o administrador: ${await criacao.text()}`);
    }
    usuario = await criacao.json();
    ok(`Usuário criado: ${cfg.adminEmail}`);
  }

  // O trigger cria o profile com o papel do metadata, mas em um usuário
  // pré-existente o papel pode estar diferente. Forçamos ADMIN aqui.
  await executarSql(ref, `
    update public.profiles
       set role = 'ADMIN', ativo = true,
           nome = nullif('${cfg.adminNome.replace(/'/g, "''")}', '')
       where id = '${usuario.id}'
  `);
  ok('Papel ADMIN confirmado no banco');

  // Link para ele definir a própria senha — nenhuma senha trafega por aqui.
  const linkResp = await fetch(`${urlProjeto}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: cabecalhos,
    body: JSON.stringify({
      type: 'recovery',
      email: cfg.adminEmail,
      redirect_to: `${cfg.siteUrl}/definir-senha`,
    }),
  });

  if (!linkResp.ok) {
    alerta('Usuário criado, mas o link de senha falhou. Use "Esqueci minha senha" na tela de login.');
    return { id: usuario.id, link: null };
  }

  const { action_link: link } = await linkResp.json();
  ok('Link de definição de senha gerado');
  return { id: usuario.id, link };
}

async function rodarSeed(ref) {
  if (!cfg.seed) return;
  passo('Inserindo dados de exemplo');
  const sql = await readFile(join(RAIZ, 'supabase', 'seed.sql'), 'utf8');
  await executarSql(ref, sql);
  ok('Clientes e contas a receber de exemplo inseridos');
}

async function gravarEnv(ref, chaves) {
  passo('Gravando apps/web/.env.local');

  const caminho = join(RAIZ, 'apps', 'web', '.env.local');

  // Preserva o AUTH_SECRET de uma execução anterior: trocá-lo invalidaria
  // todas as sessões e dispositivos confiáveis já registrados.
  let authSecret = randomBytes(48).toString('base64');
  try {
    await access(caminho);
    const atual = await readFile(caminho, 'utf8');
    const achado = atual.match(/^AUTH_SECRET=(.+)$/m)?.[1]?.trim();
    if (achado && achado.length > 20) {
      authSecret = achado;
      info('AUTH_SECRET existente preservado');
    }
  } catch { /* primeiro uso */ }

  const linhas = [
    '# Gerado por scripts/configurar-supabase.mjs — não versionar.',
    `# Projeto Supabase: ${ref}`,
    '',
    `NEXT_PUBLIC_SUPABASE_URL=https://${ref}.supabase.co`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${chaves.anon}`,
    `SUPABASE_SERVICE_ROLE_KEY=${chaves.service}`,
    '',
    `NEXT_PUBLIC_SITE_URL=${cfg.siteUrl}`,
    `AUTH_SECRET=${authSecret}`,
    '',
    cfg.resendKey ? `RESEND_API_KEY=${cfg.resendKey}` : '# RESEND_API_KEY=',
    cfg.emailFrom
      ? `EMAIL_FROM="${cfg.emailFrom}"`
      : '# EMAIL_FROM="Consultório <financeiro@seudominio.com.br>"',
    '',
    '# Preencher depois de publicar o microserviço de NFS-e:',
    '# NFSE_SERVICE_URL=',
    '# NFSE_SERVICE_TOKEN=',
    '',
  ];

  await writeFile(caminho, linhas.join('\n'), { mode: 0o600 });
  ok('apps/web/.env.local gravado');
  return { authSecret };
}

// ---------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------

async function principal() {
  if (!cfg.token) {
    falhar('Informe o token: --token sbp_... (ou a variável SUPABASE_ACCESS_TOKEN)\n'
      + '  Gere em https://supabase.com/dashboard/account/tokens');
  }

  console.log(cor('1', '\n  Configuração do Supabase — Financeiro Odonto'));

  const org = await validarToken();

  if (cfg.somenteVerificar) {
    console.log(`\n${cor('32', '✓')} Token válido. Nada foi alterado (--verificar).\n`);
    return;
  }

  const { projeto, senhaBanco } = await obterOuCriarProjeto(org);
  const ref = projeto.id;

  await esperarProjetoPronto(ref);
  await aplicarMigrations(ref);
  const chaves = await obterChaves(ref);
  await configurarAuth(ref);
  await rodarSeed(ref);
  const admin = await criarAdministrador(ref, chaves.service);
  await gravarEnv(ref, chaves);

  // -------------------------------------------------------------------
  console.log(`\n${cor('1;32', '━━ Tudo pronto ━━')}\n`);
  console.log(`  Projeto:     ${projeto.name} (${ref})`);
  console.log(`  URL:         https://${ref}.supabase.co`);
  console.log(`  Painel:      https://supabase.com/dashboard/project/${ref}`);
  console.log(`  Credenciais: apps/web/.env.local`);

  if (senhaBanco) {
    console.log(`\n  ${cor('33', 'Senha do banco (guarde no gerenciador de senhas):')}`);
    console.log(`  ${senhaBanco}`);
  }

  if (admin?.link) {
    console.log(`\n  ${cor('33', 'Link para definir a senha do administrador:')}`);
    console.log(`  ${admin.link}`);
    console.log(`  ${cor('90', '(válido por 1 hora, uso único)')}`);
  }

  console.log('');
}

principal().catch((e) => falhar(e.stack ?? e.message));
