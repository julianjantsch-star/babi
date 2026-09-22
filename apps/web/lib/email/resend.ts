import 'server-only';
import { Resend } from 'resend';
import { conferirRemetente, REMETENTE_PADRAO } from './remetente';

const remetenteConfigurado = () => process.env.EMAIL_FROM ?? REMETENTE_PADRAO;

function cliente() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

type Anexo = { filename: string; content: string };

async function enviar(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Anexo[];
}) {
  const remetente = remetenteConfigurado();
  conferirRemetente(remetente);

  const resend = cliente();
  if (!resend) {
    // Sem chave configurada, o app continua utilizável em desenvolvimento:
    // o código aparece no log do servidor em vez de ir por e-mail.
    console.warn('[email] RESEND_API_KEY ausente — não enviado:', opts.subject);
    console.warn('[email] destino:', opts.to);
    console.warn('[email] texto:', opts.text ?? '(html)');
    return { id: 'dev-noop' };
  }

  const { data, error } = await resend.emails.send({
    from: remetente,
    to: Array.isArray(opts.to) ? opts.to : [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    attachments: opts.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content).toString('base64'),
    })),
  });

  if (error) throw new Error(`Falha no envio de e-mail: ${error.message}`);
  return data;
}

const layout = (titulo: string, corpo: string) => `
<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f6fb;
 font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" style="max-width:480px;
        background:#fff;border-radius:16px;padding:32px;
        box-shadow:0 1px 3px rgba(16,24,40,.08)">
        <tr><td>
          <p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;
             text-transform:uppercase;color:#1e59f0;font-weight:700">
            Sistema Financeiro
          </p>
          <h1 style="margin:0 0 16px;font-size:20px;color:#101828">${titulo}</h1>
          ${corpo}
          <p style="margin:28px 0 0;font-size:12px;color:#98a2b3">
            Mensagem automática — não responda este e-mail.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

export function enviarCodigoOtp(email: string, nome: string, codigo: string, minutos: number) {
  return enviar({
    to: email,
    subject: `${codigo} é o seu código de acesso`,
    text: `Olá, ${nome}. Seu código de acesso é ${codigo}. Válido por ${minutos} minutos.`,
    html: layout('Código de verificação', `
      <p style="margin:0 0 20px;font-size:15px;color:#475467">
        Olá, ${nome}. Use o código abaixo para concluir seu acesso.
      </p>
      <div style="font-size:34px;font-weight:700;letter-spacing:.32em;
        text-align:center;padding:18px;background:#eef6ff;border-radius:12px;
        color:#1745dc">${codigo}</div>
      <p style="margin:20px 0 0;font-size:13px;color:#667085">
        Válido por ${minutos} minutos. Se não foi você quem tentou entrar,
        troque sua senha imediatamente.
      </p>`),
  });
}

export function enviarConvite(email: string, nome: string, link: string, papel: string) {
  return enviar({
    to: email,
    subject: 'Seu acesso ao sistema financeiro',
    text: `Olá, ${nome}. Defina sua senha em: ${link}`,
    html: layout('Bem-vindo(a)', `
      <p style="margin:0 0 20px;font-size:15px;color:#475467">
        Olá, ${nome}. Foi criado um acesso para você com o perfil
        <strong>${papel}</strong>. Defina sua senha para começar.
      </p>
      <p style="text-align:center;margin:24px 0">
        <a href="${link}" style="display:inline-block;background:#1e59f0;
          color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;
          font-weight:600">Definir minha senha</a>
      </p>`),
  });
}

export function enviarRelatorio(
  destinatarios: string[],
  titulo: string,
  resumoHtml: string,
  csv: { filename: string; content: string },
) {
  return enviar({
    to: destinatarios,
    subject: titulo,
    html: layout(titulo, `${resumoHtml}
      <p style="margin:20px 0 0;font-size:13px;color:#667085">
        A planilha completa está anexada em CSV.
      </p>`),
    attachments: [csv],
  });
}
