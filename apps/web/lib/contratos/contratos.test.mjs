/**
 * Testes do preenchimento de contrato.
 *   node --experimental-strip-types --test lib/contratos/contratos.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reaisPorExtenso, inteiroPorExtenso } from './extenso.ts';
import {
  preencherModelo, montarCampos, descricaoPagamento,
  documentoFormatado, enderecoEmLinha, marcadoresUsados,
} from './campos.ts';

// ----------------------------- extenso -------------------------------

test('escreve os casos básicos', () => {
  assert.equal(inteiroPorExtenso(0), 'zero');
  assert.equal(inteiroPorExtenso(1), 'um');
  assert.equal(inteiroPorExtenso(15), 'quinze');
  assert.equal(inteiroPorExtenso(21), 'vinte e um');
  assert.equal(inteiroPorExtenso(100), 'cem');
  assert.equal(inteiroPorExtenso(101), 'cento e um');
  assert.equal(inteiroPorExtenso(999), 'novecentos e noventa e nove');
});

test('mil não leva "um" na frente', () => {
  assert.equal(inteiroPorExtenso(1000), 'mil');
  assert.equal(inteiroPorExtenso(1500), 'mil e quinhentos');
  assert.equal(inteiroPorExtenso(2000), 'dois mil');
});

test('usa a conjunção certa entre as escalas', () => {
  // Resto menor que cem, ou múltiplo exato de cem, pede "e".
  assert.equal(inteiroPorExtenso(1030), 'mil e trinta');
  assert.equal(inteiroPorExtenso(1200), 'mil e duzentos');
  // Resto com centena e dezena não pede.
  assert.equal(inteiroPorExtenso(1234), 'mil duzentos e trinta e quatro');
});

test('escreve reais e centavos', () => {
  assert.equal(reaisPorExtenso(1), 'um real');
  assert.equal(reaisPorExtenso(2), 'dois reais');
  assert.equal(reaisPorExtenso(0.01), 'um centavo');
  assert.equal(reaisPorExtenso(0.5), 'cinquenta centavos');
  assert.equal(reaisPorExtenso(0), 'zero real');
  assert.equal(reaisPorExtenso(1234.56),
    'mil duzentos e trinta e quatro reais e cinquenta e seis centavos');
  assert.equal(reaisPorExtenso(4800), 'quatro mil e oitocentos reais');
});

test('arredonda em centavos antes de separar', () => {
  // Sem arredondar primeiro, 0.1+0.2 vira 0.30000000000000004 e some o centavo.
  assert.equal(reaisPorExtenso(0.1 + 0.2), 'trinta centavos');
  // Arredondamento que cruza a fronteira do real.
  assert.equal(reaisPorExtenso(2.999), 'três reais');
  assert.equal(reaisPorExtenso(1.01), 'um real e um centavo');
});

test('recusa valor inválido em vez de escrever bobagem', () => {
  assert.throws(() => reaisPorExtenso(-1), /inválido/);
  assert.throws(() => reaisPorExtenso(Number.NaN), /inválido/);
});

// ---------------------------- documentos -----------------------------

test('formata CPF e CNPJ conforme o tipo', () => {
  assert.equal(documentoFormatado('03430482992', 'PF'), '034.304.829-92');
  assert.equal(documentoFormatado('11444777000161', 'PJ'), '11.444.777/0001-61');
  assert.equal(documentoFormatado(null, 'PF'), '—');
  // Tamanho errado não é mascarado à força.
  assert.equal(documentoFormatado('123', 'PF'), '123');
});

test('monta o endereço pulando o que falta', () => {
  assert.equal(
    enderecoEmLinha({
      nome: 'x', documento: null, tipoPessoa: 'PF',
      logradouro: 'Rua Joinville', numero: '540', bairro: 'Vila Nova',
      municipio: 'Blumenau', uf: 'SC', cep: '89035200',
    }),
    'Rua Joinville, 540 – Vila Nova – Blumenau/SC – CEP 89035-200',
  );
  assert.equal(
    enderecoEmLinha({ nome: 'x', documento: null, tipoPessoa: 'PF' }),
    '—',
  );
});

// ---------------------------- pagamento ------------------------------

const base = {
  contratado: { nome: 'Dra. Fulana', documento: '03430482992', tipoPessoa: 'PF' },
  contratante: { nome: 'Cliente', documento: '52998224725', tipoPessoa: 'PF' },
  valorTotal: 4800,
  aVista: false,
  numParcelas: 12,
  primeiroVencimento: '2026-10-05',
  dataContrato: '2026-09-23',
  cidade: 'Blumenau',
};

test('descreve o pagamento à vista', () => {
  const texto = descricaoPagamento({ ...base, aVista: true });
  assert.match(texto, /à vista/);
  assert.match(texto, /05\/10\/2026/);
  assert.match(texto, /quatro mil e oitocentos reais/);
});

test('descreve parcelas iguais sem inventar diferença', () => {
  const texto = descricaoPagamento(base);
  assert.match(texto, /12 parcelas mensais e sucessivas de R\$\s?400,00/);
  assert.doesNotMatch(texto, /sendo a primeira/);
});

test('quando não divide exato, a primeira parcela absorve o resto', () => {
  const texto = descricaoPagamento({ ...base, valorTotal: 1000, numParcelas: 3 });
  assert.match(texto, /sendo a primeira de R\$\s?333,34/);
  assert.match(texto, /as demais de R\$\s?333,33/);
});

test('uma parcela é tratada como à vista', () => {
  assert.match(descricaoPagamento({ ...base, numParcelas: 1 }), /à vista/);
});

// ------------------------- preenchimento -----------------------------

test('troca os marcadores conhecidos', () => {
  const campos = montarCampos(base);
  const r = preencherModelo(
    'Eu, {{CONTRATADO_NOME}}, contrato {{CONTRATANTE_NOME}} por {{VALOR_TOTAL}}.',
    campos,
  );
  // O Intl em pt-BR separa "R$" do número com espaço não separável (U+00A0),
  // então comparar com espaço comum falharia por um caractere invisível.
  assert.match(r.texto, /^Eu, Dra\. Fulana, contrato Cliente por R\$\s4\.800,00\.$/);
  assert.deepEqual(r.desconhecidos, []);
});

test('marcador desconhecido fica visível em vez de sumir', () => {
  const r = preencherModelo('Valor {{INVENTADO}} fim', montarCampos(base));
  assert.match(r.texto, /\{\{INVENTADO\}\}/);
  assert.deepEqual(r.desconhecidos, ['INVENTADO']);
});

test('aponta campo conhecido que ficou vazio', () => {
  const r = preencherModelo('RG {{CONTRATADO_RG}}', montarCampos(base));
  assert.deepEqual(r.vazios, ['CONTRATADO_RG']);
});

test('aceita espaços dentro do marcador', () => {
  const r = preencherModelo('{{ CONTRATANTE_NOME }}', montarCampos(base));
  assert.equal(r.texto, 'Cliente');
});

test('paciente cai no contratante quando não informado', () => {
  assert.equal(montarCampos(base).PACIENTE_NOME, 'Cliente');
  assert.equal(
    montarCampos({ ...base, pacienteNome: '  Laura  ' }).PACIENTE_NOME,
    'Laura',
  );
  // Só espaços não conta como informado.
  assert.equal(montarCampos({ ...base, pacienteNome: '   ' }).PACIENTE_NOME, 'Cliente');
});

test('bloco de assinatura traz as duas partes', () => {
  const campos = montarCampos(base);
  assert.match(campos.ASSINATURAS, /CONTRATANTE/);
  assert.match(campos.ASSINATURAS, /CONTRATADA/);
  assert.match(campos.ASSINATURAS, /034\.304\.829-92/);
});

test('PJ assina pelo representante', () => {
  const campos = montarCampos({
    ...base,
    contratado: {
      nome: 'Clínica LTDA', documento: '11444777000161', tipoPessoa: 'PJ',
      representante: 'Dra. Fulana',
    },
  });
  assert.match(campos.ASSINATURAS, /Clínica LTDA/);
  assert.match(campos.ASSINATURAS, /Dra\. Fulana/);
  assert.match(campos.ASSINATURAS, /CNPJ 11\.444\.777\/0001-61/);
});

test('lista os marcadores que um modelo usa', () => {
  assert.deepEqual(
    marcadoresUsados('{{B}} e {{A}} e {{B}}'),
    ['A', 'B'],
  );
});

test('data e local saem por extenso', () => {
  const campos = montarCampos(base);
  assert.equal(campos.DATA_LOCAL, 'Blumenau, 23 de setembro de 2026.');
  assert.equal(campos.DATA_CONTRATO, '23/09/2026');
});
