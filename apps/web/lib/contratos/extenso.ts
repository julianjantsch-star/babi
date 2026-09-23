/**
 * Valor por extenso, em reais.
 *
 * Contrato pede o valor escrito por extenso ao lado do número: é o que
 * desempata quando o algarismo está rasurado ou foi adulterado.
 */

const UNIDADES = [
  '', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis',
  'dezessete', 'dezoito', 'dezenove',
];

const DEZENAS = [
  '', '', 'vinte', 'trinta', 'quarenta', 'cinquenta',
  'sessenta', 'setenta', 'oitenta', 'noventa',
];

const CENTENAS = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
  'seiscentos', 'setecentos', 'oitocentos', 'novecentos',
];

/** Escreve um número de 1 a 999. */
function ateNovecentos(n: number): string {
  if (n === 100) return 'cem';

  const partes: string[] = [];
  const centena = Math.floor(n / 100);
  const resto = n % 100;

  if (centena) partes.push(CENTENAS[centena]);

  if (resto < 20) {
    if (resto) partes.push(UNIDADES[resto]);
  } else {
    const dezena = Math.floor(resto / 10);
    const unidade = resto % 10;
    partes.push(unidade ? `${DEZENAS[dezena]} e ${UNIDADES[unidade]}` : DEZENAS[dezena]);
  }

  return partes.join(' e ');
}

const ESCALAS: [number, string, string][] = [
  [1_000_000_000, 'bilhão', 'bilhões'],
  [1_000_000, 'milhão', 'milhões'],
  [1_000, 'mil', 'mil'],
];

/** Escreve um inteiro por extenso, sem unidade monetária. */
export function inteiroPorExtenso(valor: number): string {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new Error(`Valor inválido para extenso: ${valor}`);
  }
  const n = Math.floor(valor);
  if (n === 0) return 'zero';

  const partes: string[] = [];
  let restante = n;

  for (const [peso, singular, plural] of ESCALAS) {
    const quantidade = Math.floor(restante / peso);
    if (!quantidade) continue;
    restante %= peso;

    // "mil" não leva "um" na frente: 1.500 é "mil e quinhentos".
    const prefixo = peso === 1_000 && quantidade === 1
      ? 'mil'
      : `${ateNovecentos(quantidade)} ${quantidade === 1 ? singular : plural}`;
    partes.push(prefixo);
  }

  if (restante) partes.push(ateNovecentos(restante));

  // A conjunção antes da última parte só entra quando ela é menor que cem
  // ou múltiplo exato de cem: "mil e duzentos", mas "mil duzentos e trinta".
  if (partes.length > 1) {
    const ultima = restante;
    const juntaComE = ultima !== 0 && (ultima < 100 || ultima % 100 === 0);
    const inicio = partes.slice(0, -1).join(', ');
    return juntaComE ? `${inicio} e ${partes.at(-1)}` : `${inicio} ${partes.at(-1)}`;
  }

  return partes[0];
}

/** Ex.: 1234.5 → "mil duzentos e trinta e quatro reais e cinquenta centavos". */
export function reaisPorExtenso(valor: number): string {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new Error(`Valor inválido para extenso: ${valor}`);
  }

  // Arredonda em centavos antes de separar, senão 0.1+0.2 vira 29 centavos.
  const centavosTotais = Math.round(valor * 100);
  const inteiros = Math.floor(centavosTotais / 100);
  const centavos = centavosTotais % 100;

  const partes: string[] = [];

  if (inteiros > 0) {
    partes.push(`${inteiroPorExtenso(inteiros)} ${inteiros === 1 ? 'real' : 'reais'}`);
  }
  if (centavos > 0) {
    partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  }
  if (partes.length === 0) return 'zero real';

  return partes.join(' e ');
}
