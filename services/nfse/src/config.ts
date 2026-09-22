import { z } from 'zod';

const esquema = z.object({
  PORT: z.coerce.number().default(8080),
  HOST: z.string().default('0.0.0.0'),

  /** Token compartilhado com a aplicação Next. */
  SERVICE_TOKEN: z.string().min(24,
    'SERVICE_TOKEN precisa de pelo menos 24 caracteres'),

  /** Certificado A1 (.pfx/.p12) em base64, e sua senha. */
  CERT_PFX_BASE64: z.string().min(1),
  CERT_SENHA: z.string(),

  AMBIENTE: z.enum(['HOMOLOGACAO', 'PRODUCAO']).default('HOMOLOGACAO'),

  /**
   * URLs do Ambiente de Dados Nacional. Ficam configuráveis porque a SEFIN
   * muda os endpoints entre fases de implantação — confira a documentação
   * vigente antes de ir a produção.
   */
  ADN_URL_HOMOLOGACAO: z.string().url()
    .default('https://sefin.producaorestrita.nfse.gov.br/SefinNacional'),
  ADN_URL_PRODUCAO: z.string().url()
    .default('https://sefin.nfse.gov.br/sefinnacional'),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  console.error('Configuração inválida:');
  for (const erro of resultado.error.errors) {
    console.error(` - ${erro.path.join('.')}: ${erro.message}`);
  }
  process.exit(1);
}

export const config = resultado.data;

export const urlBase = () =>
  config.AMBIENTE === 'PRODUCAO'
    ? config.ADN_URL_PRODUCAO
    : config.ADN_URL_HOMOLOGACAO;

/** Código do ambiente conforme o layout da DPS: 1 produção, 2 homologação. */
export const codigoAmbiente = () => (config.AMBIENTE === 'PRODUCAO' ? '1' : '2');
