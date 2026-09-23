-- =====================================================================
-- Contratos: modelos, emitentes e emissão
-- =====================================================================

create type public.modelo_contrato as enum ('ORTODONTICO', 'ALINHADOR');

-- ---------------------------------------------------------------------
-- Emitentes: o lado que presta o serviço. São dados nossos, não do
-- cliente. A dentista como pessoa física e a PJ dela são registros
-- distintos, porque o contrato e o recebível mudam conforme a escolha.
-- ---------------------------------------------------------------------

create table public.emitentes (
  id              uuid primary key default gen_random_uuid(),
  tipo_pessoa     tipo_pessoa not null,
  -- Nome civil (PF) ou razão social (PJ).
  nome            text not null,
  documento       text not null,
  -- Qualificação que entra no preâmbulo: "brasileira, casada, Cirurgiã
  -- Dentista". Texto livre porque varia com o estado civil.
  qualificacao    text,
  rg              text,
  cro             text,
  -- PJ assina por um representante; PF assina por si.
  representante        text,
  representante_doc    text,
  email           citext,
  telefone        text,
  cep             text,
  logradouro      text,
  numero          text,
  complemento     text,
  bairro          text,
  municipio       text,
  uf              char(2),
  ativo           boolean not null default true,
  -- Sugerido como pré-selecionado no formulário de contrato.
  padrao          boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint emitentes_documento_digitos check (documento ~ '^[0-9]+$')
);

create unique index emitentes_documento_uniq on public.emitentes (documento);
-- No máximo um padrão por tipo de pessoa.
create unique index emitentes_padrao_uniq
  on public.emitentes (tipo_pessoa) where padrao;

-- ---------------------------------------------------------------------
-- Modelos: o texto do contrato, com marcadores {{CAMPO}}.
--
-- Fica no banco, e não no código, porque cláusula de contrato muda por
-- decisão da dentista ou da contabilidade — e isso não pode depender de
-- uma publicação nova do sistema.
-- ---------------------------------------------------------------------

create table public.modelos_contrato (
  id          uuid primary key default gen_random_uuid(),
  chave       modelo_contrato not null unique,
  titulo      text not null,
  corpo       text not null,
  -- Enquanto false, o PDF sai marcado como rascunho. Serve para impedir
  -- que um modelo pela metade vire contrato assinado por engano.
  completo    boolean not null default false,
  ativo       boolean not null default true,
  versao      integer not null default 1,
  atualizado_por uuid references public.profiles (id),
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Contratos emitidos
-- ---------------------------------------------------------------------

create sequence public.contrato_numero_seq as bigint start 1;

create table public.contratos (
  id                uuid primary key default gen_random_uuid(),
  numero            bigint not null default nextval('public.contrato_numero_seq'),
  cliente_id        uuid not null references public.clientes (id) on delete restrict,
  emitente_id       uuid not null references public.emitentes (id) on delete restrict,
  modelo_id         uuid not null references public.modelos_contrato (id) on delete restrict,
  -- Guardado junto para o histórico sobreviver à troca de modelo.
  modelo_chave      modelo_contrato not null,
  modelo_versao     integer not null,
  recebivel_id      uuid references public.recebiveis (id) on delete set null,

  -- O paciente pode não ser quem assina (menor de idade, por exemplo).
  paciente_nome     text,

  valor_total       numeric(12,2) not null check (valor_total > 0),
  a_vista           boolean not null default false,
  num_parcelas      smallint not null check (num_parcelas between 1 and 120),
  primeiro_vencimento date not null,
  data_contrato     date not null default current_date,
  cidade            text not null default 'Blumenau',

  -- Texto já com os campos substituídos. É o que foi assinado; um ajuste
  -- posterior no modelo não pode reescrever contrato antigo.
  corpo_gerado      text not null,
  rascunho          boolean not null default false,

  cancelado         boolean not null default false,
  observacoes       text,
  created_by        uuid references public.profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (numero)
);

create index contratos_cliente_idx on public.contratos (cliente_id);
create index contratos_data_idx on public.contratos (data_contrato desc);

-- ---------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------

create trigger touch_emitentes before update on public.emitentes
  for each row execute function public.touch_updated_at();
create trigger touch_modelos_contrato before update on public.modelos_contrato
  for each row execute function public.touch_updated_at();
create trigger touch_contratos before update on public.contratos
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.emitentes        enable row level security;
alter table public.modelos_contrato enable row level security;
alter table public.contratos        enable row level security;

-- Emitentes: quem emite contrato precisa ler; só o admin altera.
create policy "emitentes: financeiro lê"
  on public.emitentes for select using (public.is_financeiro());
create policy "emitentes: admin gerencia"
  on public.emitentes for all
  using (public.is_admin()) with check (public.is_admin());

create policy "modelos: financeiro lê"
  on public.modelos_contrato for select using (public.is_financeiro());
create policy "modelos: admin gerencia"
  on public.modelos_contrato for all
  using (public.is_admin()) with check (public.is_admin());

-- Contratos geram recebíveis de origem PF ou PJ, que o Balcão não enxerga.
-- Por coerência, o Balcão também não emite contrato.
create policy "contratos: financeiro total"
  on public.contratos for all
  using (public.is_financeiro()) with check (public.is_financeiro());

-- ---------------------------------------------------------------------
-- Listagem pronta
-- ---------------------------------------------------------------------

create view public.vw_contratos
with (security_invoker = true) as
select
  ct.id,
  ct.numero,
  ct.modelo_chave,
  ct.data_contrato,
  ct.valor_total,
  ct.num_parcelas,
  ct.a_vista,
  ct.rascunho,
  ct.cancelado,
  ct.recebivel_id,
  ct.created_at,
  c.id            as cliente_id,
  c.nome          as cliente_nome,
  c.documento     as cliente_documento,
  c.tipo_pessoa   as cliente_tipo_pessoa,
  e.id            as emitente_id,
  e.nome          as emitente_nome,
  e.tipo_pessoa   as emitente_tipo_pessoa,
  m.titulo        as modelo_titulo
from public.contratos ct
join public.clientes c on c.id = ct.cliente_id
join public.emitentes e on e.id = ct.emitente_id
join public.modelos_contrato m on m.id = ct.modelo_id;

-- ---------------------------------------------------------------------
-- Emissão: cria o contrato e, na mesma transação, o recebível.
--
-- A origem do recebível acompanha o tipo do emitente: contrato assinado
-- pela PJ gera conta a receber de origem PJ, e o mesmo para PF.
-- ---------------------------------------------------------------------

create or replace function public.emitir_contrato(
  p_cliente_id          uuid,
  p_emitente_id         uuid,
  p_modelo_chave        modelo_contrato,
  p_valor_total         numeric,
  p_a_vista             boolean,
  p_num_parcelas        smallint,
  p_primeiro_vencimento date,
  p_data_contrato       date,
  p_corpo_gerado        text,
  p_paciente_nome       text default null,
  p_cidade              text default 'Blumenau',
  p_observacoes         text default null
)
returns public.contratos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_modelo    public.modelos_contrato;
  v_emitente  public.emitentes;
  v_parcelas  smallint;
  v_recebivel uuid;
  v_contrato  public.contratos;
  v_descricao text;
begin
  select * into v_modelo from public.modelos_contrato where chave = p_modelo_chave;
  if not found then
    raise exception 'Modelo de contrato % não encontrado', p_modelo_chave;
  end if;

  select * into v_emitente from public.emitentes where id = p_emitente_id;
  if not found then
    raise exception 'Emitente não encontrado';
  end if;
  if not v_emitente.ativo then
    raise exception 'Emitente % está desativado', v_emitente.nome;
  end if;

  v_parcelas := case when p_a_vista then 1 else p_num_parcelas end;
  if v_parcelas < 1 then
    raise exception 'Número de parcelas inválido';
  end if;

  v_descricao := v_modelo.titulo;

  -- O recebível nasce junto: é o mesmo ato comercial.
  v_recebivel := public.criar_recebivel(
    p_cliente_id,
    v_emitente.tipo_pessoa::text::origem_faturamento,
    v_descricao,
    p_valor_total,
    v_parcelas,
    p_primeiro_vencimento,
    p_data_contrato,
    p_observacoes
  );

  insert into public.contratos (
    cliente_id, emitente_id, modelo_id, modelo_chave, modelo_versao,
    recebivel_id, paciente_nome, valor_total, a_vista, num_parcelas,
    primeiro_vencimento, data_contrato, cidade, corpo_gerado, rascunho,
    observacoes, created_by
  ) values (
    p_cliente_id, p_emitente_id, v_modelo.id, p_modelo_chave, v_modelo.versao,
    v_recebivel, p_paciente_nome, p_valor_total, p_a_vista, v_parcelas,
    p_primeiro_vencimento, coalesce(p_data_contrato, current_date), p_cidade,
    p_corpo_gerado, not v_modelo.completo, p_observacoes, auth.uid()
  )
  returning * into v_contrato;

  insert into public.audit_log (user_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), 'EMITIR_CONTRATO', 'contratos', v_contrato.id::text,
          jsonb_build_object('numero', v_contrato.numero,
                             'modelo', p_modelo_chave,
                             'recebivel', v_recebivel));

  return v_contrato;
end;
$$;

grant execute on function public.emitir_contrato to authenticated;
