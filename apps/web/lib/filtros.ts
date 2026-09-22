import type { OrigemFaturamento, TipoPessoa } from '@/lib/types';

export interface FiltrosBusca {
  origem: OrigemFaturamento | null;
  tipoPessoa: TipoPessoa | null;
  status: 'PENDENTE' | 'PAGA' | 'VENCIDA' | null;
  mes: string;          // YYYY-MM
  inicio: string;       // YYYY-MM-01
  fim: string;          // último dia do mês
  busca: string;
  pagina: number;
}

const ORIGENS = ['PF', 'PJ', 'CLINICA'];
const PESSOAS = ['PF', 'PJ'];
const STATUS = ['PENDENTE', 'PAGA', 'VENCIDA'];

function mesPadrao() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Lê e normaliza os filtros da querystring, com defaults seguros. */
export function lerFiltros(
  params: Record<string, string | string[] | undefined>,
): FiltrosBusca {
  const um = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const origemBruta = um('origem');
  const pessoaBruta = um('pessoa');
  const statusBruto = um('status');
  const mesBruto = um('mes');

  const mes = mesBruto && /^\d{4}-\d{2}$/.test(mesBruto) ? mesBruto : mesPadrao();
  const [ano, m] = mes.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(ano, m, 0)).getUTCDate();

  const pagina = Math.max(1, Number(um('pagina') ?? 1) || 1);

  return {
    origem: origemBruta && ORIGENS.includes(origemBruta)
      ? (origemBruta as OrigemFaturamento) : null,
    tipoPessoa: pessoaBruta && PESSOAS.includes(pessoaBruta)
      ? (pessoaBruta as TipoPessoa) : null,
    status: statusBruto && STATUS.includes(statusBruto)
      ? (statusBruto as FiltrosBusca['status']) : null,
    mes,
    inicio: `${mes}-01`,
    fim: `${mes}-${String(ultimoDia).padStart(2, '0')}`,
    busca: (um('q') ?? '').trim().slice(0, 100),
    pagina,
  };
}
