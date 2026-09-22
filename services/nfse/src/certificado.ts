import forge from 'node-forge';
import { config } from './config.js';

export interface Certificado {
  /** Chave privada em PEM, usada para assinar o XML. */
  chavePrivadaPem: string;
  /** Certificado do titular em PEM. */
  certificadoPem: string;
  /** Cadeia completa (titular + intermediárias) para o handshake mTLS. */
  cadeiaPem: string;
  /** Conteúdo base64 do certificado, sem cabeçalhos — vai no X509Certificate. */
  certificadoBase64: string;
  cnpj: string | null;
  validoAte: Date;
}

let cache: Certificado | null = null;

/**
 * Abre o .pfx uma única vez e mantém em memória. O arquivo nunca toca o
 * disco: chega pelo ambiente em base64.
 */
export function carregarCertificado(): Certificado {
  if (cache) return cache;

  const der = forge.util.decode64(config.CERT_PFX_BASE64);
  const asn1 = forge.asn1.fromDer(der);

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, config.CERT_SENHA);
  } catch {
    throw new Error('Não foi possível abrir o certificado: senha incorreta '
      + 'ou arquivo inválido.');
  }

  const bagsChave = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const chave = bagsChave[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;
  if (!chave) throw new Error('Chave privada não encontrada no certificado.');

  const bagsCert = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certs = (bagsCert[forge.pki.oids.certBag] ?? [])
    .map((b) => b.cert)
    .filter((c): c is forge.pki.Certificate => !!c);

  if (certs.length === 0) throw new Error('Certificado não encontrado no arquivo.');

  // O certificado do titular é aquele cuja chave pública corresponde à privada.
  const publicaEsperada = forge.pki.publicKeyToPem(
    forge.pki.setRsaPublicKey(
      (chave as forge.pki.rsa.PrivateKey).n,
      (chave as forge.pki.rsa.PrivateKey).e,
    ),
  );
  const titular = certs.find(
    (c) => forge.pki.publicKeyToPem(c.publicKey) === publicaEsperada,
  ) ?? certs[0];

  const certificadoPem = forge.pki.certificateToPem(titular);
  const cadeiaPem = certs.map((c) => forge.pki.certificateToPem(c)).join('\n');

  const cnpjAttr = titular.subject.attributes
    .find((a) => a.name === 'commonName')?.value as string | undefined;
  const cnpj = cnpjAttr?.match(/(\d{14})/)?.[1] ?? null;

  if (titular.validity.notAfter < new Date()) {
    throw new Error(
      `Certificado digital vencido em ${titular.validity.notAfter.toLocaleDateString('pt-BR')}.`,
    );
  }

  cache = {
    chavePrivadaPem: forge.pki.privateKeyToPem(chave),
    certificadoPem,
    cadeiaPem,
    certificadoBase64: certificadoPem
      .replace(/-----(BEGIN|END) CERTIFICATE-----/g, '')
      .replace(/\s+/g, ''),
    cnpj,
    validoAte: titular.validity.notAfter,
  };

  return cache;
}

/** Buffer do .pfx para o handshake mTLS do Node. */
export const pfxBuffer = () => Buffer.from(config.CERT_PFX_BASE64, 'base64');
