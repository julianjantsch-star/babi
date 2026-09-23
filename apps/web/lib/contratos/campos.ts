/**
 * Substituição dos campos variáveis do modelo de contrato.
 *
 * O corpo do modelo é texto puro com marcadores {{CAMPO}}. Só estes campos
 * mudam de um contrato para o outro — o restante das cláusulas é fixo.
 */

import { reaisPorExtenso } from './extenso';

export interface DadosParte {
  nome: string;
  documento: string | null;
  tipoPessoa: 'PF' | 'PJ';
  qualificacao?: string | null;
  rg?: string | null;
  cro?: string | null;
  representante?: string | null;
  representanteDoc?: string | null;
  telefone?: string | null;
  email?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
}

export interface DadosContrato {
  contratado: DadosParte;
  contratante: DadosParte;
  pacienteNome?: string | null;
  valorTotal: number;
  aVista: boolean;
  numParcelas: number;
  primeiroVencimento: string;   // YYYY-MM-DD
  dataContrato: string;         // YYYY-MM-DD
  cidade: string;
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const moeda = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const dataCurta = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

const dataExtensa = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
};

/** CPF ou CNPJ com a pontuação, conforme o tipo da parte. */
export function documentoFormatado(doc: string | null, tipo: 'PF' | 'PJ') {
  const d = (doc ?? '').replace(/\D/g, '');
  if (tipo === 'PF' && d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (tipo === 'PJ' && d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return d || '—';
}

/** Endereço em uma linha, pulando os pedaços que não foram preenchidos. */
export function enderecoEmLinha(p: DadosParte) {
  const rua = [p.logradouro, p.numero].filter(Boolean).join(', ');
  const partes = [
    [rua, p.complemento].filter(Boolean).join(' — '),
    p.bairro,
    [p.municipio, p.uf].filter(Boolean).join('/'),
    p.cep ? `CEP ${p.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}` : null,
  ].filter(Boolean);
  return partes.join(' – ') || '—';
}

/** Como o pagamento é descrito no corpo do contrato. */
export function descricaoPagamento(d: DadosContrato) {
  const total = `${moeda(d.valorTotal)} (${reaisPorExtenso(d.valorTotal)})`;

  if (d.aVista || d.numParcelas === 1) {
    return `${total}, à vista, com vencimento em ${dataCurta(d.primeiroVencimento)}`;
  }

  // O resto dos centavos vai na primeira parcela, igual ao contas a receber,
  // para a soma das parcelas fechar exatamente com o total.
  const centavos = Math.round(d.valorTotal * 100);
  const base = Math.floor(centavos / d.numParcelas);
  const resto = centavos - base * d.numParcelas;
  const primeira = (base + resto) / 100;
  const demais = base / 100;

  const parcelas = resto === 0
    ? `${d.numParcelas} parcelas mensais e sucessivas de ${moeda(demais)}`
    : `${d.numParcelas} parcelas mensais e sucessivas, sendo a primeira de `
      + `${moeda(primeira)} e as demais de ${moeda(demais)}`;

  return `${total}, em ${parcelas}, vencendo a primeira em `
    + `${dataCurta(d.primeiroVencimento)}`;
}

/**
 * Bloco de assinatura de uma parte. Cada linha leva o prefixo "~", que o
 * gerador de PDF lê como linha centralizada e isolada — sem ele, as linhas
 * se juntariam num parágrafo só.
 */
const linhaAssinatura = (p: DadosParte, papel: string) => {
  const registro = p.cro ? `CRO ${p.cro}` : null;
  const doc = `${p.tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'} `
    + documentoFormatado(p.documento, p.tipoPessoa);

  const linhas = [
    '____________________________________________',
    p.nome,
    // Uma PJ não assina sozinha: quem assina é quem a representa.
    ...(p.tipoPessoa === 'PJ' && p.representante
      ? [`por ${p.representante}`] : []),
    [doc, registro].filter(Boolean).join(' - '),
    papel,
  ];

  return linhas.map((l) => `~${l}`).join('\n');
};

export function montarCampos(d: DadosContrato): Record<string, string> {
  const { contratado: co, contratante: ca } = d;

  return {
    CONTRATADO_NOME: co.nome,
    CONTRATADO_QUALIFICACAO: co.qualificacao ?? '',
    CONTRATADO_DOCUMENTO: documentoFormatado(co.documento, co.tipoPessoa),
    CONTRATADO_RG: co.rg ?? '—',
    CONTRATADO_CRO: co.cro ?? '—',
    CONTRATADO_ENDERECO: enderecoEmLinha(co),
    CONTRATADO_REPRESENTANTE: co.representante ?? '',

    CONTRATANTE_NOME: ca.nome,
    CONTRATANTE_DOCUMENTO: documentoFormatado(ca.documento, ca.tipoPessoa),
    CONTRATANTE_ENDERECO: enderecoEmLinha(ca),
    CONTRATANTE_TELEFONE: ca.telefone ?? '—',
    CONTRATANTE_EMAIL: ca.email ?? '—',

    // Quando ninguém informa o paciente, quem assina é quem será tratado.
    PACIENTE_NOME: d.pacienteNome?.trim() || ca.nome,

    VALOR_TOTAL: moeda(d.valorTotal),
    VALOR_TOTAL_EXTENSO: reaisPorExtenso(d.valorTotal),
    FORMA_PAGAMENTO: descricaoPagamento(d),
    NUM_PARCELAS: String(d.aVista ? 1 : d.numParcelas),
    PRIMEIRO_VENCIMENTO: dataCurta(d.primeiroVencimento),

    CIDADE: d.cidade,
    DATA_CONTRATO: dataCurta(d.dataContrato),
    DATA_EXTENSO: dataExtensa(d.dataContrato),
    DATA_LOCAL: `${d.cidade}, ${dataExtensa(d.dataContrato)}.`,

    ASSINATURAS: [
      linhaAssinatura(ca, 'CONTRATANTE'),
      '',
      linhaAssinatura(co, 'CONTRATADA'),
    ].join('\n\n'),
  };
}

const MARCADOR = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;

export interface ResultadoPreenchimento {
  texto: string;
  /** Marcadores que o modelo usa e que não sabemos preencher. */
  desconhecidos: string[];
  /** Marcadores conhecidos que ficaram vazios por falta de cadastro. */
  vazios: string[];
}

/**
 * Troca os marcadores pelo conteúdo. Marcador desconhecido é mantido no
 * texto, em vez de virar string vazia: sumir silenciosamente produziria um
 * contrato com uma lacuna que ninguém notaria na hora de assinar.
 */
export function preencherModelo(
  corpo: string, campos: Record<string, string>,
): ResultadoPreenchimento {
  const desconhecidos = new Set<string>();
  const vazios = new Set<string>();

  const texto = corpo.replace(MARCADOR, (original, campo: string) => {
    if (!(campo in campos)) {
      desconhecidos.add(campo);
      return original;
    }
    const valor = campos[campo];
    if (!valor || valor === '—') vazios.add(campo);
    return valor;
  });

  return {
    texto,
    desconhecidos: [...desconhecidos].sort(),
    vazios: [...vazios].sort(),
  };
}

/** Marcadores citados por um modelo, para conferência na tela de edição. */
export function marcadoresUsados(corpo: string): string[] {
  return [...new Set([...corpo.matchAll(MARCADOR)].map((m) => m[1]))].sort();
}
