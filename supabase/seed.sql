-- =====================================================================
-- Dados de exemplo para desenvolvimento.
-- Rode com: supabase db reset  (NUNCA em produção)
-- =====================================================================

insert into public.configuracoes (
  id, razao_social, nome_fantasia, cnpj, inscricao_municipal,
  cod_municipio, item_lista_servico, aliquota_iss, ambiente_nfse
) values (
  true, 'CLINICA ODONTOLOGICA EXEMPLO LTDA', 'Consultório Exemplo',
  '11222333000181', '123456', '3550308', '0412', 0.02, 'HOMOLOGACAO'
)
on conflict (id) do update set
  razao_social = excluded.razao_social,
  cod_municipio = excluded.cod_municipio;

insert into public.clientes (
  nome, tipo_pessoa, documento, email, telefone,
  cep, logradouro, numero, bairro, municipio, cod_municipio, uf
) values
  ('Maria Souza Lima', 'PF', '52998224725', 'maria@example.com', '(11) 98888-1111',
   '01310100', 'Avenida Paulista', '1000', 'Bela Vista', 'São Paulo', '3550308', 'SP'),
  ('João Pereira Santos', 'PF', '71428793860', 'joao@example.com', '(11) 97777-2222',
   '04538133', 'Avenida Brigadeiro Faria Lima', '3477', 'Itaim Bibi', 'São Paulo', '3550308', 'SP'),
  ('Convênio Saúde Total LTDA', 'PJ', '11444777000161', 'faturamento@saudetotal.com',
   '(11) 3333-4444', '01452000', 'Avenida Brigadeiro Faria Lima', '201',
   'Pinheiros', 'São Paulo', '3550308', 'SP')
on conflict (documento) where documento is not null do nothing;

-- Três contas a receber, uma por origem, para exercitar o toggle e os filtros.
do $$
declare
  v_maria uuid;
  v_joao  uuid;
  v_conv  uuid;
  v_id    uuid;
  v_base  date := date_trunc('month', current_date)::date;
begin
  -- Seed é só para desenvolvimento: se já há lançamentos, não faz nada.
  if exists (select 1 from public.recebiveis) then
    raise notice 'Recebíveis já existem — seed ignorado.';
    return;
  end if;

  select id into v_maria from public.clientes where documento = '52998224725';
  select id into v_joao  from public.clientes where documento = '71428793860';
  select id into v_conv  from public.clientes where documento = '11444777000161';

  -- PF: tratamento parcelado, primeira parcela já quitada.
  insert into public.recebiveis
    (cliente_id, origem, descricao, valor_total, num_parcelas, data_competencia)
  values (v_maria, 'PF', 'Tratamento ortodôntico — aparelho fixo', 4800.00, 12, v_base)
  returning id into v_id;

  insert into public.parcelas (recebivel_id, numero, valor, vencimento)
  select v_id, i, 400.00, (v_base + make_interval(months => i - 1))::date
  from generate_series(1, 12) as i;

  update public.parcelas
     set status = 'PAGA', data_pagamento = v_base,
         valor_pago = 400.00, forma_pagamento = 'PIX'
   where recebivel_id = v_id and numero = 1;

  -- PJ: convênio, emite NFS-e.
  insert into public.recebiveis
    (cliente_id, origem, descricao, valor_total, num_parcelas, data_competencia)
  values (v_conv, 'PJ', 'Atendimentos do convênio — competência do mês', 3200.00, 2, v_base)
  returning id into v_id;

  insert into public.parcelas (recebivel_id, numero, valor, vencimento)
  values
    (v_id, 1, 1600.00, (v_base + interval '10 days')::date),
    (v_id, 2, 1600.00, (v_base + interval '40 days')::date);

  -- Clínica: lançamento típico do balcão, com uma parcela já vencida.
  insert into public.recebiveis
    (cliente_id, origem, descricao, valor_total, num_parcelas, data_competencia)
  values (v_joao, 'CLINICA', 'Limpeza e restauração — repasse da clínica', 600.00, 2, v_base)
  returning id into v_id;

  insert into public.parcelas (recebivel_id, numero, valor, vencimento)
  values
    (v_id, 1, 300.00, (v_base - interval '5 days')::date),
    (v_id, 2, 300.00, (v_base + interval '25 days')::date);
end $$;
