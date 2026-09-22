import type { ParcelaView, Totais } from '@/lib/types';
import { moeda, data as fdata } from '@/lib/format';

const ROTULO_ORIGEM = { PF: 'Pessoa Física', PJ: 'Pessoa Jurídica', CLINICA: 'Clínica' };
const ROTULO_STATUS = { PENDENTE: 'Pendente', PAGA: 'Paga', CANCELADA: 'Cancelada' };

/** Escapa um campo para CSV (RFC 4180). */
function campo(valor: unknown) {
  const s = valor == null ? '' : String(valor);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV com separador ";" e BOM UTF-8: é o que o Excel em português abre
 * corretamente sem passar pelo assistente de importação.
 */
export function gerarCsv(parcelas: ParcelaView[]) {
  const cabecalho = [
    'Cliente', 'Documento', 'Tipo pagador', 'Origem', 'Descrição',
    'Parcela', 'Vencimento', 'Valor', 'Situação', 'Data pagamento',
    'Valor pago', 'Forma de pagamento',
  ];

  const linhas = parcelas.map((p) => [
    p.cliente_nome,
    p.cliente_documento ?? '',
    p.cliente_tipo_pessoa,
    ROTULO_ORIGEM[p.origem],
    p.descricao,
    `${p.numero}/${p.num_parcelas}`,
    fdata(p.vencimento),
    // Vírgula decimal para o Excel brasileiro reconhecer como número.
    String(Number(p.valor).toFixed(2)).replace('.', ','),
    p.vencida ? 'Vencida' : ROTULO_STATUS[p.status],
    p.data_pagamento ? fdata(p.data_pagamento) : '',
    p.valor_pago != null ? String(Number(p.valor_pago).toFixed(2)).replace('.', ',') : '',
    p.forma_pagamento ?? '',
  ]);

  const corpo = [cabecalho, ...linhas]
    .map((l) => l.map(campo).join(';'))
    .join('\r\n');

  return `﻿${corpo}`;
}

export function resumoHtml(titulo: string, t: Totais) {
  const linha = (rotulo: string, valor: number, cor: string) => `
    <tr>
      <td style="padding:8px 0;color:#475467;font-size:14px">${rotulo}</td>
      <td style="padding:8px 0;text-align:right;font-weight:700;font-size:14px;
        color:${cor}">${moeda(valor)}</td>
    </tr>`;

  return `
    <p style="margin:0 0 12px;font-size:15px;color:#475467">${titulo}</p>
    <table role="presentation" width="100%" style="border-collapse:collapse">
      ${linha('Total a receber', Number(t.total), '#101828')}
      ${linha('Recebido', Number(t.recebido), '#059669')}
      ${linha('Pendente', Number(t.pendente), '#d97706')}
      ${linha('Vencido', Number(t.vencido), '#e11d48')}
    </table>
    <p style="margin:12px 0 0;font-size:13px;color:#667085">
      ${t.qtd} parcela(s) no período.
    </p>`;
}
