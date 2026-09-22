import type { OrigemFaturamento, TipoPessoa } from '@/lib/types';

/** Valor de `mes` que significa "sem recorte de período". */
export const MES_TODOS = 'todos';

/**
 * Limites usados quando nenhum mês está selecionado. São datas absurdas de
 * propósito: cobrem qualquer lançamento sem precisar de um caminho separado
 * na consulta.
 */
export const INICIO_DOS_TEMPOS = '1900-01-01';
export const FIM_DOS_TEMPOS = '2999-12-31';

export interface FiltrosBusca {
  origem: OrigemFaturamento | null;
  tipoPessoa: TipoPessoa | null;
  status: 'PENDENTE' | 'PAGA' | 'VENCIDA' | null;
  /** 'YYYY-MM', ou MES_TODOS quando o período está aberto. */
  mes: string;
  todosOsMeses: boolean;
  inicio: string;
  fim: string;
  busca: string;
  pagina: number;
  visao: 'lista' | 'cartoes';
}

const ORIGENS = ['PF', 'PJ', 'CLINICA'];
const PESSOAS = ['PF', 'PJ'];
const STATUS = ['PENDENTE', 'PAGA', 'VENCIDA'];

export const ehMesValido = (v: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** Mês corrente no fuso local de quem acessa, no formato YYYY-MM. */
export function mesAtual(hoje = new Date()) {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
}

/** Último dia do mês, respeitando anos bissextos. */
export function ultimoDiaDoMes(mes: string) {
  const [ano, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(ano, m, 0)).getUTCDate();
}

/**
 * Anda `passo` meses a partir de um YYYY-MM. Feito com aritmética de inteiros
 * em vez de Date: somar mês em Date estoura o dia (31 de janeiro + 1 mês vira
 * 3 de março), e aqui só existe ano e mês.
 */
export function deslocarMes(mes: string, passo: number) {
  const [ano, m] = mes.split('-').map(Number);
  const total = ano * 12 + (m - 1) + passo;
  const novoAno = Math.floor(total / 12);
  const novoMes = total - novoAno * 12;
  return `${String(novoAno).padStart(4, '0')}-${String(novoMes + 1).padStart(2, '0')}`;
}

interface Opcoes {
  /**
   * Libera o valor "todos" no filtro de mês. Fica desligado por padrão: o
   * painel e os relatórios são construídos em cima de um mês de referência e
   * não fazem sentido sem recorte.
   */
  permitirTodos?: boolean;
}

/** Lê e normaliza os filtros da querystring, com defaults seguros. */
export function lerFiltros(
  params: Record<string, string | string[] | undefined>,
  { permitirTodos = false }: Opcoes = {},
): FiltrosBusca {
  const um = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const origemBruta = um('origem');
  const pessoaBruta = um('pessoa');
  const statusBruto = um('status');
  const mesBruto = um('mes');

  const todosOsMeses = permitirTodos && mesBruto === MES_TODOS;

  const mes = todosOsMeses
    ? MES_TODOS
    : (mesBruto && ehMesValido(mesBruto) ? mesBruto : mesAtual());

  const { inicio, fim } = todosOsMeses
    ? { inicio: INICIO_DOS_TEMPOS, fim: FIM_DOS_TEMPOS }
    : {
      inicio: `${mes}-01`,
      fim: `${mes}-${String(ultimoDiaDoMes(mes)).padStart(2, '0')}`,
    };

  const pagina = Math.max(1, Number(um('pagina') ?? 1) || 1);

  return {
    origem: origemBruta && ORIGENS.includes(origemBruta)
      ? (origemBruta as OrigemFaturamento) : null,
    tipoPessoa: pessoaBruta && PESSOAS.includes(pessoaBruta)
      ? (pessoaBruta as TipoPessoa) : null,
    status: statusBruto && STATUS.includes(statusBruto)
      ? (statusBruto as FiltrosBusca['status']) : null,
    mes,
    todosOsMeses,
    inicio,
    fim,
    busca: (um('q') ?? '').trim().slice(0, 100),
    pagina,
    // Lista é o padrão; cartões só quando pedido explicitamente.
    visao: um('visao') === 'cartoes' ? 'cartoes' : 'lista',
  };
}
