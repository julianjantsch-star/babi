import { codigoAmbiente } from './config.js';

export interface DadosEmissao {
  referencia: string;
  competencia: string;          // YYYY-MM-DD
  valor: number;
  discriminacao: string;
  serie: string;
  rpsNumero: number;
  prestador: {
    cnpj: string;
    inscricaoMunicipal: string | null;
    codMunicipio: string;
    itemListaServico: string;
    aliquotaIss: number;        // fração: 0.02 = 2%
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

const digitos = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');

/** Escapa os cinco caracteres que não podem aparecer cru em XML. */
function esc(valor: string) {
  return valor
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** Remove acentos e caracteres que a SEFIN rejeita em campos de texto. */
function limpar(valor: string, maximo: number) {
  return esc(
    valor.normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  ).slice(0, maximo);
}

const pad = (v: string | number, n: number) => String(v).padStart(n, '0');

/**
 * Identificador da DPS, conforme o layout nacional:
 * "DPS" + código do município (7) + tipo de inscrição (1) + inscrição (14)
 * + série (5) + número (15) — 45 caracteres no total.
 */
export function montarIdDps(d: DadosEmissao) {
  return 'DPS'
    + pad(digitos(d.prestador.codMunicipio), 7)
    + '2'                                       // 2 = CNPJ
    + pad(digitos(d.prestador.cnpj), 14)
    + pad(digitos(d.serie) || '1', 5)
    + pad(d.rpsNumero, 15);
}

function blocoTomador(t: DadosEmissao['tomador']) {
  const doc = digitos(t.documento);
  const identificacao = t.tipoPessoa === 'PJ'
    ? `<CNPJ>${pad(doc, 14)}</CNPJ>`
    : `<CPF>${pad(doc, 11)}</CPF>`;

  // O endereço só é enviado quando está completo; incompleto a SEFIN rejeita.
  const temEndereco = !!(t.logradouro && t.numero && t.bairro && t.codMunicipio && t.cep);
  const endereco = temEndereco
    ? `<end>`
      + `<endNac>`
      + `<cMun>${pad(digitos(t.codMunicipio), 7)}</cMun>`
      + `<CEP>${pad(digitos(t.cep), 8)}</CEP>`
      + `</endNac>`
      + `<xLgr>${limpar(t.logradouro!, 255)}</xLgr>`
      + `<nro>${limpar(t.numero!, 60)}</nro>`
      + (t.complemento ? `<xCpl>${limpar(t.complemento, 156)}</xCpl>` : '')
      + `<xBairro>${limpar(t.bairro!, 60)}</xBairro>`
      + `</end>`
    : '';

  return `<toma>`
    + identificacao
    + `<xNome>${limpar(t.nome, 300)}</xNome>`
    + endereco
    + (t.email ? `<email>${limpar(t.email, 80)}</email>` : '')
    + `</toma>`;
}

/**
 * Monta o XML da DPS (Declaração de Prestação de Serviços).
 *
 * ATENÇÃO: o layout do Ambiente Nacional evolui entre versões. Antes de ir a
 * produção, valide este XML contra o XSD publicado pela SEFIN para o município
 * e a versão em uso — campos obrigatórios variam conforme o regime tributário.
 */
export function montarDps(d: DadosEmissao) {
  const id = montarIdDps(d);
  const agora = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const competencia = d.competencia.slice(0, 10);
  const valor = d.valor.toFixed(2);
  const aliquota = (d.prestador.aliquotaIss * 100).toFixed(2);
  const codMun = pad(digitos(d.prestador.codMunicipio), 7);

  const regimeEspecial = d.prestador.optanteSimples ? '1' : '0';

  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">`
    + `<infDPS Id="${id}">`
    + `<tpAmb>${codigoAmbiente()}</tpAmb>`
    + `<dhEmi>${agora}</dhEmi>`
    + `<verAplic>odonto-1.0</verAplic>`
    + `<serie>${pad(digitos(d.serie) || '1', 5)}</serie>`
    + `<nDPS>${pad(d.rpsNumero, 15)}</nDPS>`
    + `<dCompet>${competencia}</dCompet>`
    + `<tpEmit>1</tpEmit>`                        // 1 = prestador
    + `<cLocEmi>${codMun}</cLocEmi>`
    + `<prest>`
    +   `<CNPJ>${pad(digitos(d.prestador.cnpj), 14)}</CNPJ>`
    +   (d.prestador.inscricaoMunicipal
          ? `<IM>${limpar(d.prestador.inscricaoMunicipal, 15)}</IM>` : '')
    +   `<regTrib>`
    +     `<opSimpNac>${d.prestador.optanteSimples ? '2' : '1'}</opSimpNac>`
    +     `<regEspTrib>${regimeEspecial === '1' ? '0' : '0'}</regEspTrib>`
    +   `</regTrib>`
    + `</prest>`
    + blocoTomador(d.tomador)
    + `<serv>`
    +   `<locPrest><cLocPrestacao>${codMun}</cLocPrestacao></locPrest>`
    +   `<cServ>`
    +     `<cTribNac>${digitos(d.prestador.itemListaServico).padStart(6, '0')}</cTribNac>`
    +     `<xDescServ>${limpar(d.discriminacao, 2000)}</xDescServ>`
    +   `</cServ>`
    + `</serv>`
    + `<valores>`
    +   `<vServPrest><vServ>${valor}</vServ></vServPrest>`
    +   `<trib>`
    +     `<tribMun>`
    +       `<tribISSQN>1</tribISSQN>`
    +       `<pAliq>${aliquota}</pAliq>`
    +       `<tpRetISSQN>${d.prestador.issRetido ? '2' : '1'}</tpRetISSQN>`
    +     `</tribMun>`
    +     `<totTrib><indTotTrib>0</indTotTrib></totTrib>`
    +   `</trib>`
    + `</valores>`
    + `</infDPS>`
    + `</DPS>`;
}
