import Fastify from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { config } from './config.js';
import { carregarCertificado } from './certificado.js';
import { emitir, consultar, cancelar } from './sefin.js';
import type { DadosEmissao } from './dps.js';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    // O XML da DPS carrega dados de paciente; não vai para o log.
    redact: ['req.headers.authorization', 'req.body'],
  },
  bodyLimit: 1_000_000,
});

/** Comparação em tempo constante do token compartilhado. */
function tokenValido(cabecalho: string | undefined) {
  if (!cabecalho?.startsWith('Bearer ')) return false;
  const recebido = Buffer.from(cabecalho.slice(7));
  const esperado = Buffer.from(config.SERVICE_TOKEN);
  if (recebido.length !== esperado.length) return false;
  return timingSafeEqual(recebido, esperado);
}

app.addHook('onRequest', async (req, reply) => {
  if (req.url === '/saude') return;
  if (!tokenValido(req.headers.authorization)) {
    return reply.code(401).send({ erro: 'Não autorizado' });
  }
});

app.get('/saude', async () => {
  try {
    const cert = carregarCertificado();
    const diasRestantes = Math.floor(
      (cert.validoAte.getTime() - Date.now()) / 86_400_000,
    );
    return {
      ok: true,
      ambiente: config.AMBIENTE,
      certificado: {
        cnpj: cert.cnpj,
        validoAte: cert.validoAte.toISOString(),
        diasRestantes,
        // Aviso antecipado: renovar A1 leva alguns dias.
        alerta: diasRestantes < 30 ? 'Certificado perto do vencimento' : null,
      },
    };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'erro' };
  }
});

app.post<{ Body: DadosEmissao }>('/nfse/emitir', async (req, reply) => {
  try {
    const resposta = await emitir(req.body);
    if (resposta.status === 'REJEITADA') return reply.code(422).send(resposta);
    return resposta;
  } catch (e) {
    req.log.error({ err: e }, 'falha na emissão');
    return reply.code(502).send({
      erro: e instanceof Error ? e.message : 'Falha ao comunicar com a SEFIN',
    });
  }
});

app.post<{ Body: { chaveAcesso: string } }>('/nfse/consultar', async (req, reply) => {
  try {
    return await consultar(req.body.chaveAcesso);
  } catch (e) {
    return reply.code(502).send({
      erro: e instanceof Error ? e.message : 'Falha na consulta',
    });
  }
});

app.post<{ Body: { chaveAcesso: string; motivo: string } }>(
  '/nfse/cancelar',
  async (req, reply) => {
    const { chaveAcesso, motivo } = req.body;
    if (!chaveAcesso || !motivo || motivo.trim().length < 15) {
      return reply.code(400).send({
        erro: 'Informe a chave de acesso e um motivo com ao menos 15 caracteres.',
      });
    }
    try {
      const resposta = await cancelar(chaveAcesso, motivo);
      if (resposta.status === 'REJEITADA') return reply.code(422).send(resposta);
      return resposta;
    } catch (e) {
      return reply.code(502).send({
        erro: e instanceof Error ? e.message : 'Falha no cancelamento',
      });
    }
  },
);

// Falha cedo: se o certificado não abre, não adianta o serviço subir.
try {
  const cert = carregarCertificado();
  app.log.info(
    { cnpj: cert.cnpj, validoAte: cert.validoAte, ambiente: config.AMBIENTE },
    'certificado carregado',
  );
} catch (e) {
  app.log.error({ err: e }, 'certificado inválido');
  process.exit(1);
}

await app.listen({ port: config.PORT, host: config.HOST });
