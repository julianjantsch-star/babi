/**
 * Testes da montagem do PDF.
 *
 * Com AMOSTRA_PDF=<caminho> o teste também grava um arquivo de exemplo,
 * para conferência visual:
 *   AMOSTRA_PDF=/tmp/amostra.pdf npm test
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { writeFile } from 'node:fs/promises';
import { gerarPdfContrato, paraWinAnsi, analisarCorpo, quebrarLinhas } from './pdf.ts';
import { montarCampos, preencherModelo } from './campos.ts';
import { PDFDocument, StandardFonts } from 'pdf-lib';

// --------------------------- normalização ----------------------------

test('preserva os acentos do português', () => {
  const texto = 'Cirurgiã-Dentista ortodôntico coração ação três';
  assert.equal(paraWinAnsi(texto), texto);
});

test('troca o que o Word cola e o PDF não aceita', () => {
  assert.equal(paraWinAnsi('“aspas” e ‘simples’'), '"aspas" e \'simples\'');
  assert.equal(paraWinAnsi('travessão — aqui'), 'travessão - aqui');
  assert.equal(paraWinAnsi('reticências…'), 'reticências...');
  // Espaço não separável vira espaço comum, senão o PDF recusa o caractere.
  assert.equal(paraWinAnsi('R$ 4.800,00'), 'R$ 4.800,00');
  assert.equal(paraWinAnsi('zero​width'), 'zerowidth');
});

test('caractere fora da tabela vira ? em vez de derrubar a geração', () => {
  assert.equal(paraWinAnsi('emoji 😀 fim'), 'emoji ? fim');
});

// ------------------------------ blocos -------------------------------

test('reconhece a marcação mínima', () => {
  const blocos = analisarCorpo('# Título\n\n## Seção\n\nParágrafo\n~ centralizado');
  assert.deepEqual(blocos.map((b) => b.tipo),
    ['titulo', 'espaco', 'secao', 'espaco', 'paragrafo', 'centro']);
  assert.equal(blocos[0].texto, 'Título');
  assert.equal(blocos[5].texto, 'centralizado');
});

test('junta linhas seguidas num parágrafo só', () => {
  // É o caso do texto colado do Word, que vem quebrado na largura da tela.
  const blocos = analisarCorpo('Primeira linha\nsegunda linha\nterceira.');
  assert.deepEqual(blocos.map((b) => b.tipo), ['paragrafo']);
  assert.equal(blocos[0].texto, 'Primeira linha segunda linha terceira.');
});

test('linha em branco começa um parágrafo novo', () => {
  const blocos = analisarCorpo('um\ndois\n\ntrês');
  assert.deepEqual(blocos.map((b) => b.texto), ['um dois', '', 'três']);
});

test('título e seção interrompem o parágrafo em andamento', () => {
  const blocos = analisarCorpo('texto antes\n## Seção\ntexto depois');
  assert.deepEqual(blocos.map((b) => b.tipo), ['paragrafo', 'secao', 'paragrafo']);
});

test('linhas centralizadas não se juntam entre si', () => {
  const blocos = analisarCorpo('~um\n~dois');
  assert.deepEqual(blocos.map((b) => b.tipo), ['centro', 'centro']);
});

test('linhas em branco seguidas não viram vários espaços', () => {
  const blocos = analisarCorpo('a\n\n\n\n\nb');
  assert.deepEqual(blocos.map((b) => b.tipo), ['paragrafo', 'espaco', 'paragrafo']);
});

test('aceita quebra de linha do Windows', () => {
  assert.deepEqual(analisarCorpo('a\r\n\r\nb').map((b) => b.texto), ['a', '', 'b']);
});

// ---------------------------- quebra de linha ------------------------

test('quebra respeitando a largura e sem cortar palavra', async () => {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const largura = 200;

  const linhas = quebrarLinhas(
    'palavra '.repeat(30).trim(), fonte, 10, largura);

  assert.ok(linhas.length > 1, 'deveria quebrar em várias linhas');
  for (const l of linhas) {
    assert.ok(fonte.widthOfTextAtSize(l, 10) <= largura, `linha larga demais: ${l}`);
  }
  assert.equal(linhas.join(' '), 'palavra '.repeat(30).trim());
});

test('palavra maior que a linha é cortada em vez de vazar a margem', async () => {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const largura = 50;
  const linhas = quebrarLinhas('A'.repeat(200), fonte, 10, largura);

  assert.ok(linhas.length > 1);
  for (const l of linhas) {
    assert.ok(fonte.widthOfTextAtSize(l, 10) <= largura);
  }
  assert.equal(linhas.join(''), 'A'.repeat(200));
});

// ------------------------------- PDF ---------------------------------

const MODELO = `# CONTRATO DE PRESTAÇÃO DE SERVIÇOS ORTODÔNTICOS

Pelo presente instrumento, de um lado {{CONTRATADO_NOME}}, {{CONTRATADO_QUALIFICACAO}},
CRO {{CONTRATADO_CRO}}, CPF {{CONTRATADO_DOCUMENTO}}, com consultório à
{{CONTRATADO_ENDERECO}}, e de outro {{CONTRATANTE_NOME}}, CPF
{{CONTRATANTE_DOCUMENTO}}, residente à {{CONTRATANTE_ENDERECO}}, para o
tratamento de {{PACIENTE_NOME}}, ficam justos e acertados:

## 1 - DO OBJETO

${'Cláusula longa para forçar a paginação do documento. '.repeat(90)}

## 2 - DO PAGAMENTO

O valor total é de {{FORMA_PAGAMENTO}}.

{{DATA_LOCAL}}

{{ASSINATURAS}}`;

const DADOS = {
  contratado: {
    nome: 'Dra. Exemplo', documento: '03430482992', tipoPessoa: 'PF',
    qualificacao: 'brasileira, Cirurgiã Dentista', cro: 'SC 0000',
    logradouro: 'Rua Exemplo', numero: '540', municipio: 'Blumenau', uf: 'SC',
  },
  contratante: {
    nome: 'Paciente de Teste', documento: '52998224725', tipoPessoa: 'PF',
    logradouro: 'Rua Teste', numero: '10', municipio: 'Blumenau', uf: 'SC',
  },
  valorTotal: 4800, aVista: false, numParcelas: 12,
  primeiroVencimento: '2026-10-05', dataContrato: '2026-09-23', cidade: 'Blumenau',
};

test('gera um PDF válido, com várias páginas e sem marcador sobrando', async () => {
  const { texto, desconhecidos } = preencherModelo(MODELO, montarCampos(DADOS));
  assert.deepEqual(desconhecidos, []);
  assert.doesNotMatch(texto, /\{\{/, 'sobrou marcador sem preencher');

  const bytes = await gerarPdfContrato({
    corpo: texto,
    titulo: 'Contrato de teste',
    numero: 1,
    rodape: 'Contrato nº 1',
  });

  assert.ok(bytes.length > 1000, 'PDF pequeno demais para ser real');
  // %PDF- no começo do arquivo.
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), '%PDF-');

  const lido = await PDFDocument.load(bytes);
  assert.ok(lido.getPageCount() > 1, 'o texto longo deveria ocupar mais de uma página');
  assert.match(lido.getTitle() ?? '', /Contrato de teste/);

  const { width, height } = lido.getPage(0).getSize();
  assert.ok(Math.abs(width - 595.28) < 1 && Math.abs(height - 841.89) < 1, 'não é A4');

  if (process.env.AMOSTRA_PDF) await writeFile(process.env.AMOSTRA_PDF, bytes);
});

test('carimba rascunho quando o modelo não está completo', async () => {
  const { texto } = preencherModelo('# T\n\ncorpo', montarCampos(DADOS));
  const comCarimbo = await gerarPdfContrato({
    corpo: texto, titulo: 'T', numero: 2, rascunho: true,
  });
  const semCarimbo = await gerarPdfContrato({
    corpo: texto, titulo: 'T', numero: 2, rascunho: false,
  });
  assert.ok(comCarimbo.length > semCarimbo.length,
    'o carimbo deveria acrescentar conteúdo à página');
});

test('não quebra com corpo vazio', async () => {
  const bytes = await gerarPdfContrato({ corpo: '', titulo: 'Vazio', numero: 0 });
  const lido = await PDFDocument.load(bytes);
  assert.equal(lido.getPageCount(), 1);
});
