/**
 * Testes dos filtros de período e visualização.
 *   node --experimental-strip-types --test lib/filtros.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  lerFiltros, deslocarMes, ultimoDiaDoMes, mesAtual, ehMesValido,
  MES_TODOS, INICIO_DOS_TEMPOS, FIM_DOS_TEMPOS,
} from './filtros.ts';

// --------------------------- aritmética ------------------------------

test('avança e recua um mês dentro do mesmo ano', () => {
  assert.equal(deslocarMes('2026-05', 1), '2026-06');
  assert.equal(deslocarMes('2026-05', -1), '2026-04');
});

test('vira o ano corretamente nas bordas', () => {
  assert.equal(deslocarMes('2026-12', 1), '2027-01');
  assert.equal(deslocarMes('2026-01', -1), '2025-12');
});

test('anda vários meses de uma vez', () => {
  assert.equal(deslocarMes('2026-01', 12), '2027-01');
  assert.equal(deslocarMes('2026-01', -13), '2024-12');
  assert.equal(deslocarMes('2026-09', 0), '2026-09');
});

test('nunca produz mês 00 nem 13', () => {
  // Percorre dois anos inteiros somando de um em um.
  let mes = '2025-01';
  for (let i = 0; i < 24; i++) {
    mes = deslocarMes(mes, 1);
    const [, m] = mes.split('-').map(Number);
    assert.ok(m >= 1 && m <= 12, `mês inválido gerado: ${mes}`);
    assert.ok(ehMesValido(mes), `formato inválido: ${mes}`);
  }
  assert.equal(mes, '2027-01');
});

test('último dia do mês cobre fevereiro e anos bissextos', () => {
  assert.equal(ultimoDiaDoMes('2026-02'), 28);
  assert.equal(ultimoDiaDoMes('2024-02'), 29);
  assert.equal(ultimoDiaDoMes('2026-04'), 30);
  assert.equal(ultimoDiaDoMes('2026-12'), 31);
});

test('mesAtual usa o mês do relógio, com zero à esquerda', () => {
  assert.equal(mesAtual(new Date(2026, 0, 15)), '2026-01');
  assert.equal(mesAtual(new Date(2026, 11, 31)), '2026-12');
});

test('ehMesValido recusa mês fora de 01..12', () => {
  assert.ok(ehMesValido('2026-01'));
  assert.ok(ehMesValido('2026-12'));
  assert.ok(!ehMesValido('2026-13'));
  assert.ok(!ehMesValido('2026-00'));
  assert.ok(!ehMesValido('2026-1'));
  assert.ok(!ehMesValido('todos'));
});

// ---------------------------- leitura --------------------------------

test('sem mês na URL, assume o mês corrente', () => {
  const f = lerFiltros({});
  assert.equal(f.mes, mesAtual());
  assert.equal(f.todosOsMeses, false);
  assert.equal(f.inicio, `${mesAtual()}-01`);
});

test('mês inválido cai no mês corrente em vez de quebrar', () => {
  for (const mes of ['2026-13', 'abc', '', '2026', '99999-01']) {
    assert.equal(lerFiltros({ mes }).mes, mesAtual(), `falhou para ${mes}`);
  }
});

test('calcula início e fim do mês pedido', () => {
  const f = lerFiltros({ mes: '2026-02' });
  assert.equal(f.inicio, '2026-02-01');
  assert.equal(f.fim, '2026-02-28');
});

test('"todos" só vale onde a página permite', () => {
  const bloqueado = lerFiltros({ mes: MES_TODOS });
  assert.equal(bloqueado.todosOsMeses, false);
  assert.equal(bloqueado.mes, mesAtual());

  const liberado = lerFiltros({ mes: MES_TODOS }, { permitirTodos: true });
  assert.equal(liberado.todosOsMeses, true);
  assert.equal(liberado.mes, MES_TODOS);
  assert.equal(liberado.inicio, INICIO_DOS_TEMPOS);
  assert.equal(liberado.fim, FIM_DOS_TEMPOS);
});

test('a visualização padrão é lista', () => {
  assert.equal(lerFiltros({}).visao, 'lista');
  assert.equal(lerFiltros({ visao: 'cartoes' }).visao, 'cartoes');
  assert.equal(lerFiltros({ visao: 'lista' }).visao, 'lista');
  // Valor desconhecido não deve virar uma terceira visualização.
  assert.equal(lerFiltros({ visao: 'tabela' }).visao, 'lista');
});

test('ignora valores fora do domínio nos demais filtros', () => {
  const f = lerFiltros({ origem: 'XPTO', pessoa: 'PJ', status: 'INVENTADO' });
  assert.equal(f.origem, null);
  assert.equal(f.tipoPessoa, 'PJ');
  assert.equal(f.status, null);
});

test('parâmetro repetido usa a primeira ocorrência', () => {
  const f = lerFiltros({ mes: ['2026-03', '2026-07'], origem: ['PJ', 'PF'] });
  assert.equal(f.mes, '2026-03');
  assert.equal(f.origem, 'PJ');
});

test('página nunca é menor que 1', () => {
  assert.equal(lerFiltros({ pagina: '0' }).pagina, 1);
  assert.equal(lerFiltros({ pagina: '-5' }).pagina, 1);
  assert.equal(lerFiltros({ pagina: 'abc' }).pagina, 1);
  assert.equal(lerFiltros({ pagina: '3' }).pagina, 3);
});
