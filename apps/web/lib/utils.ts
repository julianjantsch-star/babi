import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const soDigitos = (v: string) => v.replace(/\D/g, '');

export function validaCPF(cpf: string) {
  const c = soDigitos(cpf);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (base: string, peso: number) => {
    const soma = base.split('').reduce((s, n, i) => s + Number(n) * (peso - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(c.slice(0, 9), 10) === Number(c[9])
      && dv(c.slice(0, 10), 11) === Number(c[10]);
}

export function validaCNPJ(cnpj: string) {
  const c = soDigitos(cnpj);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (base: string) => {
    let peso = base.length - 7;
    const soma = base.split('').reduce((s, n) => {
      const v = s + Number(n) * peso;
      peso = peso - 1 < 2 ? 9 : peso - 1;
      return v;
    }, 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(c.slice(0, 12)) === Number(c[12])
      && calc(c.slice(0, 13)) === Number(c[13]);
}
