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

/**
 * Maiúscula só na primeira letra. O CSS `capitalize` não serve aqui: ele
 * maiusculiza toda palavra e produz "Setembro De 2026".
 */
export const capitalizar = (texto: string) =>
  texto.charAt(0).toUpperCase() + texto.slice(1);

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

export const isoDe = (d: Date) => d.toISOString().slice(0, 10);

export const hojeISO = () => isoDe(new Date());
