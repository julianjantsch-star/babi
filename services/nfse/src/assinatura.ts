import { SignedXml } from 'xml-crypto';
import { carregarCertificado } from './certificado.js';

/**
 * Assina o elemento <infDPS> com XMLDSig enveloped, RSA-SHA1 sobre SHA-1 —
 * que é o perfil exigido pelo padrão NFS-e/SPED. O <Signature> resultante
 * entra como irmão de <infDPS>, dentro de <DPS>.
 */
export function assinarDps(xml: string, idDps: string) {
  const cert = carregarCertificado();

  const assinador = new SignedXml({
    privateKey: cert.chavePrivadaPem,
    publicCert: cert.certificadoPem,
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  });

  assinador.addReference({
    xpath: `//*[local-name(.)='infDPS']`,
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    uri: `#${idDps}`,
  });

  // O padrão espera apenas o X509Certificate dentro de KeyInfo.
  assinador.getKeyInfoContent = () =>
    `<X509Data><X509Certificate>${cert.certificadoBase64}</X509Certificate></X509Data>`;

  assinador.computeSignature(xml, {
    location: { reference: `//*[local-name(.)='infDPS']`, action: 'after' },
  });

  return assinador.getSignedXml();
}
