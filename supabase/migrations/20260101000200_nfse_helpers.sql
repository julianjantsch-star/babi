-- =====================================================================
-- Apoio à emissão de NFS-e
-- =====================================================================

alter table public.configuracoes
  add column if not exists serie_rps text not null default '1';

-- Numeração do RPS. Precisa ser sequencial e sem buracos por série; a
-- sequência do Postgres resolve concorrência sem lock de tabela.
create or replace function public.nextval_rps()
returns bigint
language sql
security definer
set search_path = public
as $$
  select nextval('public.rps_numero_seq')
$$;

revoke all on function public.nextval_rps() from public;
grant execute on function public.nextval_rps() to service_role;

-- Notas emitidas com dados do cliente e do recebível, para a listagem.
create view public.vw_notas_fiscais
with (security_invoker = true) as
select
  n.*,
  c.nome        as cliente_nome,
  c.documento   as cliente_documento,
  c.tipo_pessoa as cliente_tipo_pessoa,
  r.descricao   as recebivel_descricao,
  r.origem      as recebivel_origem
from public.notas_fiscais n
join public.clientes c on c.id = n.cliente_id
left join public.recebiveis r on r.id = n.recebivel_id;
