-- =====================================================================
-- Row Level Security, views de agregação e funções de negócio
-- =====================================================================

alter table public.profiles        enable row level security;
alter table public.clientes        enable row level security;
alter table public.recebiveis      enable row level security;
alter table public.parcelas        enable row level security;
alter table public.notas_fiscais   enable row level security;
alter table public.configuracoes   enable row level security;
alter table public.audit_log       enable row level security;
alter table public.auth_otp        enable row level security;
alter table public.trusted_devices enable row level security;

-- auth_otp e trusted_devices são manipulados exclusivamente pela service
-- role no servidor. Sem policies = nenhum acesso via chave anônima.

-- --------------------------- profiles --------------------------------

create policy "profiles: leitura própria"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: admin lê todos"
  on public.profiles for select
  using (public.is_admin());

create policy "profiles: admin gerencia"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- --------------------------- clientes --------------------------------

create policy "clientes: financeiro total"
  on public.clientes for all
  using (public.is_financeiro())
  with check (public.is_financeiro());

-- O balcão precisa localizar e cadastrar pacientes para lançar na clínica.
create policy "clientes: balcao lê"
  on public.clientes for select
  using (public.is_balcao());

create policy "clientes: balcao cadastra"
  on public.clientes for insert
  with check (public.is_balcao());

create policy "clientes: balcao edita"
  on public.clientes for update
  using (public.is_balcao())
  with check (public.is_balcao());

-- -------------------------- recebiveis -------------------------------

create policy "recebiveis: financeiro total"
  on public.recebiveis for all
  using (public.is_financeiro())
  with check (public.is_financeiro());

-- O balcão é confinado à origem CLINICA, tanto na leitura quanto na escrita.
create policy "recebiveis: balcao clinica"
  on public.recebiveis for select
  using (public.is_balcao() and origem = 'CLINICA');

create policy "recebiveis: balcao lanca clinica"
  on public.recebiveis for insert
  with check (public.is_balcao() and origem = 'CLINICA');

create policy "recebiveis: balcao edita clinica"
  on public.recebiveis for update
  using (public.is_balcao() and origem = 'CLINICA')
  with check (public.is_balcao() and origem = 'CLINICA');

-- --------------------------- parcelas --------------------------------

create policy "parcelas: financeiro total"
  on public.parcelas for all
  using (public.is_financeiro())
  with check (public.is_financeiro());

create policy "parcelas: balcao clinica"
  on public.parcelas for select
  using (
    public.is_balcao()
    and exists (
      select 1 from public.recebiveis r
      where r.id = parcelas.recebivel_id and r.origem = 'CLINICA'
    )
  );

create policy "parcelas: balcao insere clinica"
  on public.parcelas for insert
  with check (
    public.is_balcao()
    and exists (
      select 1 from public.recebiveis r
      where r.id = parcelas.recebivel_id and r.origem = 'CLINICA'
    )
  );

create policy "parcelas: balcao quita clinica"
  on public.parcelas for update
  using (
    public.is_balcao()
    and exists (
      select 1 from public.recebiveis r
      where r.id = parcelas.recebivel_id and r.origem = 'CLINICA'
    )
  )
  with check (
    public.is_balcao()
    and exists (
      select 1 from public.recebiveis r
      where r.id = parcelas.recebivel_id and r.origem = 'CLINICA'
    )
  );

-- ------------------------ notas fiscais ------------------------------
-- Emissão de nota é privativa do admin.

create policy "notas: admin total"
  on public.notas_fiscais for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "notas: financeiro lê"
  on public.notas_fiscais for select
  using (public.is_financeiro());

-- ------------------------ configurações ------------------------------

create policy "config: todos leem"
  on public.configuracoes for select
  using (auth.uid() is not null);

create policy "config: admin edita"
  on public.configuracoes for all
  using (public.is_admin())
  with check (public.is_admin());

-- -------------------------- auditoria --------------------------------

create policy "audit: admin lê"
  on public.audit_log for select
  using (public.is_admin());

create policy "audit: autenticado escreve"
  on public.audit_log for insert
  with check (auth.uid() is not null);

-- =====================================================================
-- Views de agregação (security_invoker: respeitam o RLS de quem consulta)
-- =====================================================================

create view public.vw_parcelas
with (security_invoker = true) as
select
  p.id,
  p.recebivel_id,
  p.numero,
  p.valor,
  p.vencimento,
  p.status,
  p.data_pagamento,
  p.valor_pago,
  p.forma_pagamento,
  r.origem,
  r.descricao,
  r.num_parcelas,
  r.cancelado,
  c.id   as cliente_id,
  c.nome as cliente_nome,
  c.tipo_pessoa as cliente_tipo_pessoa,
  c.documento   as cliente_documento,
  -- Vencida = pendente com vencimento anterior a hoje.
  (p.status = 'PENDENTE' and p.vencimento < current_date) as vencida,
  date_trunc('month', p.vencimento)::date as mes_vencimento,
  date_trunc('month', p.data_pagamento)::date as mes_recebimento
from public.parcelas p
join public.recebiveis r on r.id = p.recebivel_id
join public.clientes   c on c.id = r.cliente_id;

comment on view public.vw_parcelas is
  'Parcela achatada com dados do recebível e do cliente, para listagens e filtros.';

-- Total a receber por mês de vencimento, quebrado por origem.
create view public.vw_resumo_mensal
with (security_invoker = true) as
select
  mes_vencimento,
  origem,
  count(*)                                                     as qtd_parcelas,
  sum(valor)                                                   as total,
  coalesce(sum(valor) filter (where status = 'PAGA'), 0)       as recebido,
  coalesce(sum(valor) filter (where status = 'PENDENTE'), 0)   as pendente,
  coalesce(sum(valor) filter (where vencida), 0)               as vencido
from public.vw_parcelas
where status <> 'CANCELADA' and not cancelado
group by mes_vencimento, origem;

-- Caixa realizado: o que de fato entrou em cada mês.
create view public.vw_recebido_mensal
with (security_invoker = true) as
select
  mes_recebimento,
  origem,
  forma_pagamento,
  count(*)            as qtd_parcelas,
  sum(valor_pago)     as recebido
from public.vw_parcelas
where status = 'PAGA' and data_pagamento is not null
group by mes_recebimento, origem, forma_pagamento;

-- =====================================================================
-- Funções de negócio
-- =====================================================================

-- Cria o recebível e gera as parcelas numa única transação.
-- O resto da divisão é somado à primeira parcela, de modo que a soma das
-- parcelas seja sempre exatamente igual ao valor total.
create or replace function public.criar_recebivel(
  p_cliente_id       uuid,
  p_origem           origem_faturamento,
  p_descricao        text,
  p_valor_total      numeric,
  p_num_parcelas     smallint,
  p_primeiro_vencimento date,
  p_data_competencia date default current_date,
  p_observacoes      text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id          uuid;
  v_base        numeric(12,2);
  v_resto       numeric(12,2);
  v_valor       numeric(12,2);
  i             smallint;
begin
  if p_num_parcelas < 1 or p_num_parcelas > 120 then
    raise exception 'Número de parcelas inválido: %', p_num_parcelas;
  end if;
  if p_valor_total <= 0 then
    raise exception 'Valor total deve ser positivo';
  end if;

  insert into public.recebiveis (
    cliente_id, origem, descricao, valor_total, num_parcelas,
    data_competencia, observacoes, created_by
  ) values (
    p_cliente_id, p_origem, p_descricao, p_valor_total, p_num_parcelas,
    coalesce(p_data_competencia, current_date), p_observacoes, auth.uid()
  )
  returning id into v_id;

  v_base  := trunc(p_valor_total / p_num_parcelas, 2);
  v_resto := p_valor_total - (v_base * p_num_parcelas);

  for i in 1..p_num_parcelas loop
    v_valor := v_base + case when i = 1 then v_resto else 0 end;
    insert into public.parcelas (recebivel_id, numero, valor, vencimento)
    values (
      v_id, i, v_valor,
      (p_primeiro_vencimento + make_interval(months => i - 1))::date
    );
  end loop;

  return v_id;
end;
$$;

-- Baixa da parcela. Quitação é sempre integral (valor da parcela).
create or replace function public.quitar_parcela(
  p_parcela_id     uuid,
  p_data_pagamento date,
  p_forma          forma_pagamento,
  p_observacoes    text default null
)
returns public.parcelas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_parcela public.parcelas;
begin
  select * into v_parcela from public.parcelas where id = p_parcela_id for update;

  if not found then
    raise exception 'Parcela não encontrada';
  end if;
  if v_parcela.status = 'PAGA' then
    raise exception 'Parcela já quitada em %', v_parcela.data_pagamento;
  end if;
  if v_parcela.status = 'CANCELADA' then
    raise exception 'Parcela cancelada não pode ser quitada';
  end if;
  if p_data_pagamento > current_date then
    raise exception 'Data de pagamento não pode ser futura';
  end if;

  update public.parcelas
     set status          = 'PAGA',
         data_pagamento  = p_data_pagamento,
         valor_pago      = valor,
         forma_pagamento = p_forma,
         observacoes     = coalesce(p_observacoes, observacoes),
         quitado_por     = auth.uid(),
         quitado_em      = now()
   where id = p_parcela_id
   returning * into v_parcela;

  insert into public.audit_log (user_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), 'QUITAR_PARCELA', 'parcelas', p_parcela_id::text,
          jsonb_build_object('data_pagamento', p_data_pagamento, 'forma', p_forma));

  return v_parcela;
end;
$$;

-- Estorna a baixa, devolvendo a parcela para pendente.
create or replace function public.estornar_parcela(p_parcela_id uuid)
returns public.parcelas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_parcela public.parcelas;
begin
  update public.parcelas
     set status          = 'PENDENTE',
         data_pagamento  = null,
         valor_pago      = null,
         forma_pagamento = null,
         quitado_por     = null,
         quitado_em      = null
   where id = p_parcela_id and status = 'PAGA'
   returning * into v_parcela;

  if not found then
    raise exception 'Parcela não está quitada';
  end if;

  insert into public.audit_log (user_id, acao, entidade, entidade_id)
  values (auth.uid(), 'ESTORNAR_PARCELA', 'parcelas', p_parcela_id::text);

  return v_parcela;
end;
$$;

-- Totais consolidados do período, já filtrados por RLS.
-- p_origem nulo = todas as origens.
create or replace function public.totais_periodo(
  p_inicio date,
  p_fim    date,
  p_origem origem_faturamento default null,
  p_tipo_pessoa tipo_pessoa default null
)
returns table (
  total      numeric,
  recebido   numeric,
  pendente   numeric,
  vencido    numeric,
  qtd        bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(sum(valor), 0),
    coalesce(sum(valor) filter (where status = 'PAGA'), 0),
    coalesce(sum(valor) filter (where status = 'PENDENTE'), 0),
    coalesce(sum(valor) filter (where vencida), 0),
    count(*)
  from public.vw_parcelas
  where status <> 'CANCELADA'
    and not cancelado
    and vencimento between p_inicio and p_fim
    and (p_origem is null or origem = p_origem)
    and (p_tipo_pessoa is null or cliente_tipo_pessoa = p_tipo_pessoa)
$$;

grant execute on function public.criar_recebivel  to authenticated;
grant execute on function public.quitar_parcela   to authenticated;
grant execute on function public.estornar_parcela to authenticated;
grant execute on function public.totais_periodo   to authenticated;
