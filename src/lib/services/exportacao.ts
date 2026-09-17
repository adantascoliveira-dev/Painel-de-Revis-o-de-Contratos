import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { PDFDocument, StandardFonts } from 'pdf-lib';

export interface DadosExportacao {
  titulo: string;
  subtitulo: string;
  texto: string;
}

/** Divide o texto de trabalho em parágrafos (linha em branco separa parágrafos; quebras simples viram <br>). */
function paragrafos(texto: string): string[][] {
  return texto.split(/\n{2,}/).map((bloco) => bloco.split('\n'));
}

export async function gerarDocxDocumento({ titulo, subtitulo, texto }: DadosExportacao): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: titulo, heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun({ text: subtitulo, color: '666666', size: 20 })], spacing: { after: 300 } }),
          ...paragrafos(texto).map(
            (linhas) =>
              new Paragraph({
                children: linhas.flatMap((linha, i) =>
                  i === 0 ? [new TextRun(linha)] : [new TextRun({ text: linha, break: 1 })]
                ),
                spacing: { after: 200 },
              })
          ),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

const PAGINA_LARGURA = 595.28; // A4 em pontos
const PAGINA_ALTURA = 841.89;
const MARGEM = 56;
const LARGURA_UTIL = PAGINA_LARGURA - MARGEM * 2;

export async function gerarPdfDocumento({ titulo, subtitulo, texto }: DadosExportacao): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const fonteNegrito = await pdf.embedFont(StandardFonts.HelveticaBold);

  let pagina = pdf.addPage([PAGINA_LARGURA, PAGINA_ALTURA]);
  let y = PAGINA_ALTURA - MARGEM;

  function novaPaginaSeNecessario(alturaLinha: number) {
    if (y - alturaLinha < MARGEM) {
      pagina = pdf.addPage([PAGINA_LARGURA, PAGINA_ALTURA]);
      y = PAGINA_ALTURA - MARGEM;
    }
  }

  function escreverLinha(conteudo: string, opts: { fonteUsada: typeof fonte; tamanho: number }) {
    const alturaLinha = opts.tamanho * 1.4;
    novaPaginaSeNecessario(alturaLinha);
    pagina.drawText(conteudo, { x: MARGEM, y, size: opts.tamanho, font: opts.fonteUsada });
    y -= alturaLinha;
  }

  /** Quebra uma linha lógica em várias linhas de PDF respeitando a largura útil da página. */
  function escreverComQuebra(conteudo: string, opts: { fonteUsada: typeof fonte; tamanho: number }) {
    if (!conteudo.trim()) {
      escreverLinha('', opts);
      return;
    }
    const palavras = conteudo.split(/\s+/);
    let linhaAtual = '';
    for (const palavra of palavras) {
      const tentativa = linhaAtual ? `${linhaAtual} ${palavra}` : palavra;
      const largura = opts.fonteUsada.widthOfTextAtSize(tentativa, opts.tamanho);
      if (largura > LARGURA_UTIL && linhaAtual) {
        escreverLinha(linhaAtual, opts);
        linhaAtual = palavra;
      } else {
        linhaAtual = tentativa;
      }
    }
    if (linhaAtual) escreverLinha(linhaAtual, opts);
  }

  escreverComQuebra(titulo, { fonteUsada: fonteNegrito, tamanho: 16 });
  y -= 4;
  escreverComQuebra(subtitulo, { fonteUsada: fonte, tamanho: 10 });
  y -= 12;

  for (const linhas of paragrafos(texto)) {
    for (const linha of linhas) {
      escreverComQuebra(linha, { fonteUsada: fonte, tamanho: 11 });
    }
    y -= 8;
  }

  return Buffer.from(await pdf.save());
}
