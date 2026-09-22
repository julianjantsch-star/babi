-- =====================================================================
-- Sistema Financeiro Odontológico — schema inicial
-- Supabase (PostgreSQL 15) — plano gratuito
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------

-- Quem está faturando o serviço. Define também se há emissão de NFS-e:
-- apenas a origem PJ (CNPJ da dentista) emite nota pelo sistema.
create type public.origem_faturamento as enum ('PF', 'PJ', 'CLINICA');

-- Natureza do pagador (paciente/convênio).
create type public.tipo_pessoa as enum ('PF', 'PJ');

create type public.status_parcela as enum ('PENDENTE', 'PAGA', 'CANCELADA');

create type public.forma_pagamento as enum (
  'DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO',
  'TRANSFERENCIA', 'BOLETO', 'CHEQUE', 'OUTRO'
);

create type public.app_role as enum ('ADMIN', 'FINANCEIRO', 'BALCAO');

create type public.nfse_status as enum (
  'PENDENTE', 'PROCESSANDO', 'AUTORIZADA', 'REJEITADA', 'CANCELADA'
);

-- ---------------------------------------------------------------------
-- Perfis de usuário (espelha auth.users)
-- ---------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nome        text        not null,
  email       citext      not null unique,
  role        app_role    not null default 'BALCAO',
  ativo       boolean     not null default true,
  telefone    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Dados de aplicação do usuário. A autenticação em si vive em auth.users.';

-- Cria o profile automaticamente quando um usuário é criado no Auth.
-- O role chega via user_metadata definido pelo admin no momento do convite.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::app_role, 'BALCAO')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Helpers de autorização (SECURITY DEFINER para não recursar em RLS)
-- ---------------------------------------------------------------------

create or replace function public.current_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.ativo
$$;

create or replace function public.is_admin()
returns boolean
language sql stable
as $$ select public.current_role() = 'ADMIN' $$;

-- Admin e Financeiro enxergam todo o financeiro.
create or replace function public.is_financeiro()
returns boolean
language sql stable
as $$ select public.current_role() in ('ADMIN', 'FINANCEIRO') $$;

create or replace function public.is_balcao()
returns boolean
language sql stable
as $$ select public.current_role() = 'BALCAO' $$;

-- ---------------------------------------------------------------------
-- Clientes / pacientes
-- ---------------------------------------------------------------------

create table public.clientes (
  id            uuid primary key default gen_random_uuid(),
  nome          text        not null,
  tipo_pessoa   tipo_pessoa not null default 'PF',
  documento     text,                      -- CPF ou CNPJ, apenas dígitos
  email         citext,
  telefone      text,
  -- Endereço é obrigatório apenas para tomadores de NFS-e.
  cep           text,
  logradouro    text,
  numero        text,
  complemento   text,
  bairro        text,
  municipio     text,
  cod_municipio text,                      -- código IBGE, exigido na NFS-e
  uf            char(2),
  observacoes   text,
  ativo         boolean     not null default true,
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint clientes_documento_digitos check (documento is null or documento ~ '^[0-9]+$')
);

create index clientes_nome_idx on public.clientes using gin (to_tsvector('portuguese', nome));
create index clientes_documento_idx on public.clientes (documento);
create unique index clientes_documento_uniq on public.clientes (documento) where documento is not null;

-- ---------------------------------------------------------------------
-- Contas a receber
-- ---------------------------------------------------------------------

create table public.recebiveis (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid not null references public.clientes (id) on delete restrict,
  origem            origem_faturamento not null,
  descricao         text not null,
  valor_total       numeric(12,2) not null check (valor_total > 0),
  num_parcelas      smallint not null check (num_parcelas between 1 and 120),
  data_competencia  date not null default current_date,
  observacoes       text,
  cancelado         boolean not null default false,
  created_by        uuid references public.profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index recebiveis_origem_idx on public.recebiveis (origem);
create index recebiveis_cliente_idx on public.recebiveis (cliente_id);
create index recebiveis_competencia_idx on public.recebiveis (data_competencia desc);

create table public.parcelas (
  id               uuid primary key default gen_random_uuid(),
  recebivel_id     uuid not null references public.recebiveis (id) on delete cascade,
  numero           smallint not null check (numero > 0),
  valor            numeric(12,2) not null check (valor > 0),
  vencimento       date not null,
  status           status_parcela not null default 'PENDENTE',
  data_pagamento   date,
  valor_pago       numeric(12,2),
  forma_pagamento  forma_pagamento,
  observacoes      text,
  quitado_por      uuid references public.profiles (id),
  quitado_em       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (recebivel_id, numero),
  -- Uma parcela paga precisa obrigatoriamente da data de quitação.
  constraint parcelas_paga_exige_data check (
    (status = 'PAGA' and data_pagamento is not null and valor_pago is not null)
    or (status <> 'PAGA' and data_pagamento is null and valor_pago is null)
  )
);

create index parcelas_status_idx on public.parcelas (status);
create index parcelas_vencimento_idx on public.parcelas (vencimento);
create index parcelas_recebivel_idx on public.parcelas (recebivel_id);
-- Índice do mês de competência do recebimento: alimenta o resumo mensal.
create index parcelas_pagamento_idx on public.parcelas (data_pagamento) where data_pagamento is not null;

-- ---------------------------------------------------------------------
-- Notas fiscais de serviço (NFS-e Nacional)
-- ---------------------------------------------------------------------

create table public.notas_fiscais (
  id                 uuid primary key default gen_random_uuid(),
  recebivel_id       uuid references public.recebiveis (id) on delete set null,
  parcela_id         uuid references public.parcelas (id) on delete set null,
  cliente_id         uuid not null references public.clientes (id) on delete restrict,
  status             nfse_status not null default 'PENDENTE',
  valor              numeric(12,2) not null check (valor > 0),
  discriminacao      text not null,
  competencia        date not null,
  -- Numeração própria do RPS/DPS, sequencial por série.
  serie              text not null default '1',
  rps_numero         bigint not null,
  -- Retorno da SEFIN Nacional
  chave_acesso       text,
  numero_nfse        text,
  codigo_verificacao text,
  data_emissao       timestamptz,
  xml_dps            text,
  xml_nfse           text,
  pdf_url            text,
  erro               text,
  cancelada_em       timestamptz,
  motivo_cancelamento text,
  created_by         uuid references public.profiles (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (serie, rps_numero)
);

create index notas_status_idx on public.notas_fiscais (status);
create index notas_competencia_idx on public.notas_fiscais (competencia desc);

-- Sequência do RPS. A NFS-e exige numeração contínua por série.
create sequence public.rps_numero_seq as bigint start 1;

-- ---------------------------------------------------------------------
-- Configuração do prestador (registro único)
-- ---------------------------------------------------------------------

create table public.configuracoes (
  id                   boolean primary key default true check (id),
  razao_social         text,
  nome_fantasia        text,
  cnpj                 text,
  inscricao_municipal  text,
  cod_municipio        text,
  -- 04.01 — "Medicina e biomedicina" / odontologia usa 04.12 na maioria dos
  -- municípios. Confirmar com a contabilidade antes de emitir em produção.
  item_lista_servico   text default '0412',
  cnae                 text,
  aliquota_iss         numeric(5,4) default 0.02,
  iss_retido           boolean not null default false,
  regime_tributario    text default 'SIMPLES_NACIONAL',
  optante_simples      boolean not null default true,
  ambiente_nfse        text not null default 'HOMOLOGACAO'
                       check (ambiente_nfse in ('HOMOLOGACAO', 'PRODUCAO')),
  updated_at           timestamptz not null default now()
);

insert into public.configuracoes (id) values (true) on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2FA por e-mail (OTP) e dispositivos confiáveis
-- ---------------------------------------------------------------------

create table public.auth_otp (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  code_hash   text not null,               -- sha256(codigo + pepper)
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  attempts    smallint not null default 0,
  created_at  timestamptz not null default now()
);

create index auth_otp_user_idx on public.auth_otp (user_id, created_at desc);

create table public.trusted_devices (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  token_hash  text not null unique,
  user_agent  text,
  expires_at  timestamptz not null,
  last_used_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index trusted_devices_user_idx on public.trusted_devices (user_id);

-- ---------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------

create table public.audit_log (
  id         bigserial primary key,
  user_id    uuid references public.profiles (id),
  acao       text not null,
  entidade   text not null,
  entidade_id text,
  detalhes   jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'clientes', 'recebiveis', 'parcelas', 'notas_fiscais', 'configuracoes'
  ] loop
    execute format(
      'create trigger touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;
