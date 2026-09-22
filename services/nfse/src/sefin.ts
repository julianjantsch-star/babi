import { gzipSync } from 'node:zlib';
import { Agent, request } from 'undici';
import { DOMParser } from '@xmldom/xmldom';
import { config, urlBase } from './config.js';
import { pfxBuffer } from './certificado.js';
import { montarDps, montarIdDps, type DadosEmissao } from './dps.js';
import { assinarDps } from './assinatura.js';

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

let agente: Agent | null = null;

/**
 * Agente HTTP com o certificado A1 apresentado no handshake. É a razão de
 * este serviço existir: Edge Functions não fazem mTLS.
 */
function agenteMtls() {
  if (agente) return agente;
  agente = new Agent({
    connect: {
      pfx: pfxBuffer(),
      passphrase: config.CERT_SENHA,
      // A cadeia da SEFIN é pública e válida; manter a verificação ligada.
      rejectUnauthorized: true,
    },
    headersTimeout: 40_000,
    bodyTimeout: 40_000,
  });
  return agente;
}

async function chamarAdn(caminho: string, metodo: 'GET' | 'POST', corpo?: unknown) {
  const resposta = await request(`${urlBase()}${caminho}`, {
    method: metodo,
    dispatcher: agenteMtls(),
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });

  const texto = await resposta.body.text();
  let dados: Record<string, unknown> = {};
  try { dados = texto ? JSON.parse(texto) : {}; } catch { dados = { mensagem: texto }; }

  return { status: resposta.statusCode, dados };
}

interface DadosNfse {
  numeroNfse?: string;
  codigoVerificacao?: string;
  dataEmissao?: string;
}

/** Extrai número, código de verificação e data do XML da NFS-e retornada. */
function lerNfse(xml: string): DadosNfse {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const ler = (tag: string) =>
    doc.getElementsByTagName(tag)[0]?.textContent?.trim() || undefined;

  return {
    numeroNfse: ler('nNFSe'),
    codigoVerificacao: ler('cVerif') ?? ler('codigoVerificacao'),
    dataEmissao: ler('dhProc') ?? ler('dhEmi'),
  };
}

const mensagemErro = (dados: Record<string, unknown>) => {
  const erros = dados.erros;
  if (Array.isArray(erros) && erros.length > 0) {
    return erros
      .map((e) => {
        const item = e as Record<string, unknown>;
        return [item.Codigo ?? item.codigo, item.Descricao ?? item.descricao ?? item.Mensagem]
          .filter(Boolean).join(' — ');
      })
      .join(' | ');
  }
  return String(dados.mensagem ?? dados.Mensagem ?? 'Erro não detalhado pela SEFIN');
};

export async function emitir(dados: DadosEmissao): Promise<RespostaEmissao> {
  const xml = montarDps(dados);
  const assinado = assinarDps(xml, montarIdDps(dados));

  // O ADN recebe a DPS compactada em gzip e codificada em base64.
  const dpsXmlGZipB64 = gzipSync(Buffer.from(assinado, 'utf8')).toString('base64');

  const { status, dados: corpo } = await chamarAdn('/nfse', 'POST', { dpsXmlGZipB64 });

  if (status >= 400) {
    return { status: 'REJEITADA', xmlDps: assinado, erro: mensagemErro(corpo) };
  }

  const nfseB64 = corpo.nfseXmlGZipB64 as string | undefined;
  let xmlNfse: string | undefined;
  let extraido: DadosNfse = {};

  if (nfseB64) {
    const { gunzipSync } = await import('node:zlib');
    xmlNfse = gunzipSync(Buffer.from(nfseB64, 'base64')).toString('utf8');
    extraido = lerNfse(xmlNfse);
  }

  const chaveAcesso = (corpo.chaveAcesso ?? corpo.ChaveAcesso) as string | undefined;

  return {
    status: 'AUTORIZADA',
    chaveAcesso,
    xmlDps: assinado,
    xmlNfse,
    // O DANFSe é servido pelo portal nacional a partir da chave de acesso.
    pdfUrl: chaveAcesso
      ? `${urlBase()}/danfse/${chaveAcesso}` : undefined,
    ...extraido,
  };
}

export async function consultar(chaveAcesso: string): Promise<RespostaEmissao> {
  const { status, dados } = await chamarAdn(`/nfse/${chaveAcesso}`, 'GET');
  if (status >= 400) return { status: 'REJEITADA', erro: mensagemErro(dados) };

  const nfseB64 = dados.nfseXmlGZipB64 as string | undefined;
  let xmlNfse: string | undefined;
  let extraido: DadosNfse = {};
  if (nfseB64) {
    const { gunzipSync } = await import('node:zlib');
    xmlNfse = gunzipSync(Buffer.from(nfseB64, 'base64')).toString('utf8');
    extraido = lerNfse(xmlNfse);
  }

  return { status: 'AUTORIZADA', chaveAcesso, xmlNfse, ...extraido };
}

/**
 * Cancelamento é um evento (e101101 — cancelamento por substituição não é
 * usado aqui). O prazo de cancelamento é definido por cada município.
 */
export async function cancelar(chaveAcesso: string, motivo: string): Promise<RespostaEmissao> {
  const { status, dados } = await chamarAdn(
    `/nfse/${chaveAcesso}/eventos`, 'POST',
    { tipoEvento: 'e101101', motivo },
  );

  if (status >= 400) return { status: 'REJEITADA', chaveAcesso, erro: mensagemErro(dados) };
  return { status: 'AUTORIZADA', chaveAcesso };
}
