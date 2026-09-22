export type OrigemFaturamento = 'PF' | 'PJ' | 'CLINICA';
export type TipoPessoa = 'PF' | 'PJ';
export type StatusParcela = 'PENDENTE' | 'PAGA' | 'CANCELADA';
export type AppRole = 'ADMIN' | 'FINANCEIRO' | 'BALCAO';
export type NfseStatus =
  | 'PENDENTE' | 'PROCESSANDO' | 'AUTORIZADA' | 'REJEITADA' | 'CANCELADA';
export type FormaPagamento =
  | 'DINHEIRO' | 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO'
  | 'TRANSFERENCIA' | 'BOLETO' | 'CHEQUE' | 'OUTRO';

export const ORIGENS: { value: OrigemFaturamento; label: string; hint: string }[] = [
  { value: 'PF', label: 'Pessoa Física', hint: 'Atendimento como autônoma (CPF)' },
  { value: 'PJ', label: 'Pessoa Jurídica', hint: 'Faturado pelo CNPJ — emite NFS-e' },
  { value: 'CLINICA', label: 'Clínica', hint: 'Repasse/parceria com a clínica' },
];

export const TIPOS_PESSOA: { value: TipoPessoa; label: string }[] = [
  { value: 'PF', label: 'Pessoa Física' },
  { value: 'PJ', label: 'Pessoa Jurídica' },
];

export const FORMAS_PAGAMENTO: { value: FormaPagamento; label: string }[] = [
  { value: 'PIX', label: 'PIX' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'CARTAO_CREDITO', label: 'Cartão de crédito' },
  { value: 'CARTAO_DEBITO', label: 'Cartão de débito' },
  { value: 'TRANSFERENCIA', label: 'Transferência' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'OUTRO', label: 'Outro' },
];

export const ROLES: { value: AppRole; label: string; descricao: string }[] = [
  { value: 'ADMIN', label: 'Administrador',
    descricao: 'Acesso total: financeiro, notas fiscais e usuários' },
  { value: 'FINANCEIRO', label: 'Financeiro',
    descricao: 'Contas a receber e relatórios de todas as origens' },
  { value: 'BALCAO', label: 'Balcão',
    descricao: 'Somente lançamentos e baixas da origem Clínica' },
];

export interface Profile {
  id: string;
  nome: string;
  email: string;
  role: AppRole;
  ativo: boolean;
  telefone: string | null;
  created_at: string;
}

export interface Cliente {
  id: string;
  nome: string;
  tipo_pessoa: TipoPessoa;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  cod_municipio: string | null;
  uf: string | null;
  observacoes: string | null;
  ativo: boolean;
}

export interface Recebivel {
  id: string;
  cliente_id: string;
  origem: OrigemFaturamento;
  descricao: string;
  valor_total: number;
  num_parcelas: number;
  data_competencia: string;
  observacoes: string | null;
  cancelado: boolean;
  created_at: string;
}

export interface ParcelaView {
  id: string;
  recebivel_id: string;
  numero: number;
  valor: number;
  vencimento: string;
  status: StatusParcela;
  data_pagamento: string | null;
  valor_pago: number | null;
  forma_pagamento: FormaPagamento | null;
  origem: OrigemFaturamento;
  descricao: string;
  num_parcelas: number;
  cancelado: boolean;
  cliente_id: string;
  cliente_nome: string;
  cliente_tipo_pessoa: TipoPessoa;
  cliente_documento: string | null;
  vencida: boolean;
  mes_vencimento: string;
  mes_recebimento: string | null;
}

export interface Totais {
  total: number;
  recebido: number;
  pendente: number;
  vencido: number;
  qtd: number;
}

export interface ResumoMensal {
  mes_vencimento: string;
  origem: OrigemFaturamento;
  qtd_parcelas: number;
  total: number;
  recebido: number;
  pendente: number;
  vencido: number;
}

export interface NotaFiscal {
  id: string;
  recebivel_id: string | null;
  parcela_id: string | null;
  cliente_id: string;
  status: NfseStatus;
  valor: number;
  discriminacao: string;
  competencia: string;
  serie: string;
  rps_numero: number;
  chave_acesso: string | null;
  numero_nfse: string | null;
  codigo_verificacao: string | null;
  data_emissao: string | null;
  pdf_url: string | null;
  erro: string | null;
  created_at: string;
}
