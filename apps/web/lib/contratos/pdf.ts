import {
  PDFDocument, StandardFonts, rgb, degrees,
  type PDFFont, type PDFPage,
} from 'pdf-lib';

/**
 * Monta o PDF do contrato a partir do texto já preenchido.
 *
 * O corpo usa uma marcação mínima, pensada para quem edita o modelo pela
 * tela e não escreve código:
 *   # Título          → centralizado e em negrito, maior
 *   ## Seção          → em negrito, alinhado à esquerda
 *   ~ linha           → centralizada (usado no bloco de assinaturas)
 *   linha em branco   → separa parágrafos
 */

const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = { esquerda: 56, direita: 56, topo: 64, base: 64 };
const LARGURA_UTIL = A4.largura - MARGEM.esquerda - MARGEM.direita;

const CORPO = 10;
const ENTRELINHA = 14;
const TITULO = 13;
const SECAO = 10.5;

/**
 * As fontes padrão do PDF usam WinAnsi (CP1252), que cobre o português mas
 * não cobre tudo que vem colado do Word. Um caractere fora da tabela derruba
 * a geração inteira, então normalizamos antes em vez de quebrar na hora.
 */
export function paraWinAnsi(texto: string): string {
  const trocas: Record<string, string> = {
    '‘': "'", '’': "'", '“': '"', '”': '"',
    '–': '-', '—': '-', '…': '...', ' ': ' ',
    ' ': ' ', ' ': ' ', '​': '', '﻿': '',
    '•': '-', '−': '-', '­': '',
  };

  return texto
    .replace(/[‘’“”–—…   ​﻿•−­]/g,
      (c) => trocas[c] ?? '')
    // Qualquer resto fora do Latin-1 imprimível vira "?" — visível na
    // revisão, em vez de estourar a geração do documento. A flag u faz a
    // classe trabalhar por ponto de código: sem ela, um emoji (par
    // substituto em UTF-16) viraria dois "?" em vez de um.
    .replace(/[^\n\r\t\x20-\x7E\xA0-\xFF]/gu, '?');
}

/** Quebra o texto em linhas que cabem na largura, sem cortar palavra. */
export function quebrarLinhas(
  texto: string, fonte: PDFFont, tamanho: number, largura: number,
): string[] {
  const cabe = (s: string) => fonte.widthOfTextAtSize(s, tamanho) <= largura;
  const linhas: string[] = [];
  let atual = '';

  for (const palavra of texto.trim().split(/\s+/).filter(Boolean)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;

    if (cabe(tentativa)) {
      atual = tentativa;
      continue;
    }

    if (atual) { linhas.push(atual); atual = ''; }

    if (cabe(palavra)) {
      atual = palavra;
      continue;
    }

    // Palavra sozinha maior que a linha (URL, documento longo): corta à força,
    // senão ela vazaria para fora da margem.
    let pedaco = '';
    for (const letra of palavra) {
      if (pedaco && !cabe(pedaco + letra)) {
        linhas.push(pedaco);
        pedaco = letra;
      } else {
        pedaco += letra;
      }
    }
    atual = pedaco;
  }

  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [''];
}

interface Bloco {
  tipo: 'titulo' | 'secao' | 'paragrafo' | 'centro' | 'espaco';
  texto: string;
}

/**
 * Converte o texto marcado em blocos de renderização.
 *
 * Linhas normais seguidas formam um parágrafo só. Sem isso, um texto colado
 * do Word — que vem quebrado na largura da tela — sairia com uma linha curta
 * atrás da outra. Parágrafo novo se faz com linha em branco.
 */
export function analisarCorpo(corpo: string): Bloco[] {
  const blocos: Bloco[] = [];
  let acumulado: string[] = [];

  const fecharParagrafo = () => {
    if (!acumulado.length) return;
    blocos.push({ tipo: 'paragrafo', texto: acumulado.join(' ') });
    acumulado = [];
  };

  for (const bruta of corpo.replace(/\r\n/g, '\n').split('\n')) {
    const linha = bruta.trim();

    if (!linha) {
      fecharParagrafo();
      // Espaços seguidos não viram vários vazios.
      if (blocos.at(-1)?.tipo !== 'espaco') blocos.push({ tipo: 'espaco', texto: '' });
      continue;
    }
    if (linha.startsWith('## ')) {
      fecharParagrafo();
      blocos.push({ tipo: 'secao', texto: linha.slice(3).trim() });
      continue;
    }
    if (linha.startsWith('# ')) {
      fecharParagrafo();
      blocos.push({ tipo: 'titulo', texto: linha.slice(2).trim() });
      continue;
    }
    if (linha.startsWith('~')) {
      // Linha centralizada nunca se junta à vizinha: é usada no bloco de
      // assinaturas, onde cada linha precisa ficar sozinha.
      fecharParagrafo();
      blocos.push({ tipo: 'centro', texto: linha.slice(1).trim() });
      continue;
    }
    acumulado.push(linha);
  }

  fecharParagrafo();
  return blocos;
}

export interface OpcoesPdf {
  corpo: string;
  titulo: string;
  numero: number | string;
  /** Carimba "RASCUNHO" quando o modelo ainda não foi dado por completo. */
  rascunho?: boolean;
  rodape?: string;
}

export async function gerarPdfContrato(opcoes: OpcoesPdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${opcoes.titulo} nº ${opcoes.numero}`);
  doc.setCreator('Financeiro Odonto');
  doc.setProducer('Financeiro Odonto');

  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);

  const paginas: PDFPage[] = [];
  let pagina = doc.addPage([A4.largura, A4.altura]);
  paginas.push(pagina);
  let y = A4.altura - MARGEM.topo;

  const novaPagina = () => {
    pagina = doc.addPage([A4.largura, A4.altura]);
    paginas.push(pagina);
    y = A4.altura - MARGEM.topo;
  };

  const garantirEspaco = (altura: number) => {
    if (y - altura < MARGEM.base) novaPagina();
  };

  const escrever = (
    linhas: string[], fonte: PDFFont, tamanho: number, centralizado: boolean,
  ) => {
    for (const linha of linhas) {
      garantirEspaco(ENTRELINHA);
      const x = centralizado
        ? MARGEM.esquerda + (LARGURA_UTIL - fonte.widthOfTextAtSize(linha, tamanho)) / 2
        : MARGEM.esquerda;
      pagina.drawText(linha, { x, y, size: tamanho, font: fonte, color: rgb(0.1, 0.1, 0.1) });
      y -= ENTRELINHA;
    }
  };

  for (const bloco of analisarCorpo(paraWinAnsi(opcoes.corpo))) {
    switch (bloco.tipo) {
      case 'espaco':
        y -= ENTRELINHA * 0.6;
        break;
      case 'titulo':
        garantirEspaco(ENTRELINHA * 2);
        y -= ENTRELINHA * 0.4;
        escrever(quebrarLinhas(bloco.texto, negrito, TITULO, LARGURA_UTIL),
          negrito, TITULO, true);
        y -= ENTRELINHA * 0.5;
        break;
      case 'secao':
        // Seção órfã no pé da página fica feia e atrapalha a leitura.
        garantirEspaco(ENTRELINHA * 3);
        y -= ENTRELINHA * 0.3;
        escrever(quebrarLinhas(bloco.texto, negrito, SECAO, LARGURA_UTIL),
          negrito, SECAO, false);
        break;
      case 'centro':
        escrever(quebrarLinhas(bloco.texto, normal, CORPO, LARGURA_UTIL),
          normal, CORPO, true);
        break;
      default:
        escrever(quebrarLinhas(bloco.texto, normal, CORPO, LARGURA_UTIL),
          normal, CORPO, false);
    }
  }

  // Rodapé e marca de rascunho só depois, com o total de páginas conhecido.
  paginas.forEach((p, i) => {
    const rodape = [opcoes.rodape, `Página ${i + 1} de ${paginas.length}`]
      .filter(Boolean).join('   ·   ');
    p.drawText(paraWinAnsi(rodape), {
      x: MARGEM.esquerda,
      y: MARGEM.base / 2,
      size: 7.5,
      font: normal,
      color: rgb(0.55, 0.55, 0.55),
    });

    if (opcoes.rascunho) {
      p.drawText('RASCUNHO', {
        x: A4.largura / 2 - 150,
        y: A4.altura / 2,
        size: 60,
        font: negrito,
        color: rgb(0.92, 0.92, 0.92),
        rotate: degrees(35),
      });
    }
  });

  return doc.save();
}
