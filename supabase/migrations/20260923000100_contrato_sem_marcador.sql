-- =====================================================================
-- Rede de segurança: contrato não pode ser gravado com marcador aberto
--
-- O preenchimento acontece na aplicação, antes de chamar emitir_contrato.
-- Se alguém chamar a função direto — de um script, do painel do banco, de
-- uma integração futura — o texto entraria como está, e um contrato com
-- "{{CONTRATANTE_NOME}}" impresso chegaria à mesa de assinatura.
-- =====================================================================

alter table public.contratos
  add constraint contratos_sem_marcador_aberto
  check (corpo_gerado !~ '\{\{\s*[A-Z0-9_]+\s*\}\}');

comment on constraint contratos_sem_marcador_aberto on public.contratos is
  'O corpo precisa chegar com todos os campos já substituídos.';
