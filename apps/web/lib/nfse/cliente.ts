import 'server-only';

/**
 * Ponte para o microserviço de NFS-e.
 *
 * A API do Ambiente de Dados Nacional (ADN/SEFIN) exige mTLS com o
 * certificado digital A1 do prestador, e o runtime das Edge Functions do
 * Supabase (Deno Deploy) não permite apresentar certificado de cliente.
 * Por isso o XML é assinado e transmitido por um serviço Node dedicado
 * (services/nfse), que é o único lugar onde o .pfx existe.
 */

export interface DadosEmissao {
  referencia: string;
  competencia: string;
  valor: number;
  discriminacao: string;
  serie: string;
  rpsNumero: number;
  prestador: {
    cnpj: string;
    inscricaoMunicipal: string | null;
    codMunicipio: string;
    itemListaServico: string;
    aliquotaIss: number;
    issRetido: boolean;
    optanteSimples: boolean;
  };
  tomador: {
    tipoPessoa: 'PF' | 'PJ';
    documento: string | null;
    nome: string;
    email: string | null;
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    codMunicipio: string | null;
    uf: string | null;
  };
}

export interface RespostaEmissao {
  status: 'AUTORIZADA' | 'REJEITADA' | 'PROCESSANDO';
  chaveAcesso?: string;
  numeroNfse?: string;
  codigoVerificacao?: string;
  dataEmissao?: string;
  xmlDps?: string;
  xmlNfse?: string;
  pdfUrl?: string;
  erro?: string;
}

class ErroNfse extends Error {
  constructor(message: string, readonly detalhe?: unknown) {
    super(message);
    this.name = 'ErroNfse';
  }
}

function configurado() {
  const base = process.env.NFSE_SERVICE_URL;
  const token = process.env.NFSE_SERVICE_TOKEN;
  if (!base || !token) return null;
  return { base: base.replace(/\/$/, ''), token };
}

async function chamar<T>(caminho: string, corpo: unknown): Promise<T> {
  const cfg = configurado();
  if (!cfg) {
    throw new ErroNfse(
      'Serviço de NFS-e não configurado. Defina NFSE_SERVICE_URL e '
      + 'NFSE_SERVICE_TOKEN nas variáveis de ambiente.',
    );
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${cfg.base}${caminho}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.token}`,
      },
      body: JSON.stringify(corpo),
      // A SEFIN costuma responder em poucos segundos; 45s cobre o pior caso.
      signal: AbortSignal.timeout(45_000),
      cache: 'no-store',
    });
  } catch (e) {
    throw new ErroNfse(
      e instanceof Error && e.name === 'TimeoutError'
        ? 'O serviço de NFS-e não respondeu a tempo.'
        : 'Não foi possível contatar o serviço de NFS-e.',
    );
  }

  const texto = await resposta.text();
  let dados: unknown;
  try { dados = texto ? JSON.parse(texto) : {}; } catch { dados = { erro: texto }; }

  if (!resposta.ok) {
    const msg = (dados as { erro?: string })?.erro
      ?? `Serviço de NFS-e respondeu ${resposta.status}`;
    throw new ErroNfse(msg, dados);
  }

  return dados as T;
}

export const emitirNfse = (dados: DadosEmissao) =>
  chamar<RespostaEmissao>('/nfse/emitir', dados);

export const cancelarNfse = (chaveAcesso: string, motivo: string) =>
  chamar<RespostaEmissao>('/nfse/cancelar', { chaveAcesso, motivo });

export const consultarNfse = (chaveAcesso: string) =>
  chamar<RespostaEmissao>('/nfse/consultar', { chaveAcesso });

export const nfseDisponivel = () => configurado() !== null;
