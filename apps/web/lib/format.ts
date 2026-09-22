const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL',
});

export const moeda = (v: number | string | null | undefined) =>
  BRL.format(Number(v ?? 0));

/** Formata uma data ISO (YYYY-MM-DD) sem deslocar o fuso. */
export function data(iso: string | null | undefined) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function mesExtenso(iso: string) {
  const [y, m] = iso.slice(0, 10).split('-');
  const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${nomes[Number(m) - 1]} de ${y}`;
}

export function documento(doc: string | null, tipo: 'PF' | 'PJ') {
  if (!doc) return '—';
  const d = doc.replace(/\D/g, '');
  if (tipo === 'PF' && d.length === 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (tipo === 'PJ' && d.length === 14)
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return d;
}

/** Primeiro e último dia do mês de uma data ISO, em ISO. */
export function limitesDoMes(iso: string) {
  const [y, m] = iso.slice(0, 10).split('-').map(Number);
  const inicio = new Date(Date.UTC(y, m - 1, 1));
  const fim = new Date(Date.UTC(y, m, 0));
  return { inicio: isoDe(inicio), fim: isoDe(fim) };
}

export const isoDe = (d: Date) => d.toISOString().slice(0, 10);

export const hojeISO = () => isoDe(new Date());

export function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
