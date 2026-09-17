import JSZip from 'jszip';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export const MIME_AGEITOS = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  odt: 'application/vnd.oasis.opendocument.text',
} as const;

export const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024; // 20 MB

export class ArquivoInvalidoError extends Error {}

function decodificarEntidadesXml(texto: string): string {
  return texto
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Extração pragmática de .odt: o conteúdo textual mora em content.xml dentro
 * do zip; cada parágrafo/título (<text:p>, <text:h>) vira uma linha, o que
 * preserva a numeração de cláusula desde que cada cláusula comece um novo
 * parágrafo — o padrão usual em minutas.
 */
async function extrairTextoOdt(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const contentXml = await zip.file('content.xml')?.async('string');
  if (!contentXml) {
    throw new ArquivoInvalidoError('Arquivo .odt sem content.xml — não parece ser um documento OpenDocument válido.');
  }

  const linhas: string[] = [];
  const padraoParagrafo = /<text:(p|h)[^>]*>([\s\S]*?)<\/text:\1>/g;
  for (const match of contentXml.matchAll(padraoParagrafo)) {
    const semTags = match[2].replace(/<[^>]+>/g, '');
    linhas.push(decodificarEntidadesXml(semTags));
  }
  return linhas.join('\n');
}

export interface ResultadoExtracao {
  texto: string;
}

/**
 * Extrai o texto de .docx/.pdf/.odt preservando, na medida do formato, a
 * numeração de cláusulas (cada parágrafo do original vira uma linha do texto
 * extraído — a extração de cláusulas em src/lib/extracao/clausulas.ts depende
 * disso para casar cabeçalhos como "CLÁUSULA 3ª" no início de linha).
 */
export async function extrairTextoDeArquivo(buffer: Buffer, mime: string): Promise<ResultadoExtracao> {
  if (buffer.byteLength > TAMANHO_MAXIMO_BYTES) {
    throw new ArquivoInvalidoError('Arquivo maior que 20 MB.');
  }

  switch (mime) {
    case MIME_AGEITOS.docx: {
      const { value } = await mammoth.extractRawText({ buffer });
      return { texto: value };
    }
    case MIME_AGEITOS.pdf: {
      const parser = new PDFParse({ data: buffer });
      try {
        const resultado = await parser.getText();
        return { texto: resultado.text };
      } finally {
        await parser.destroy();
      }
    }
    case MIME_AGEITOS.odt:
      return { texto: await extrairTextoOdt(buffer) };
    default:
      throw new ArquivoInvalidoError(`Tipo de arquivo não suportado: ${mime}. Aceitos: .docx, .pdf, .odt.`);
  }
}
