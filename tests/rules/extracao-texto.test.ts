import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { ArquivoInvalidoError, extrairTextoDeArquivo, MIME_AGEITOS } from '@/lib/extracao/texto';

async function construirOdtFalso(paragrafos: string[]): Promise<Buffer> {
  const zip = new JSZip();
  const corpo = paragrafos.map((p) => `<text:p>${p}</text:p>`).join('');
  const contentXml = `<?xml version="1.0"?><office:document-content xmlns:text="text" xmlns:office="office"><office:body><office:text>${corpo}</office:text></office:body></office:document-content>`;
  zip.file('content.xml', contentXml);
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('extrairTextoDeArquivo — .odt', () => {
  it('extrai um parágrafo por linha, preservando a numeração de cláusula', async () => {
    const buffer = await construirOdtFalso(['Preâmbulo do contrato.', 'CLÁUSULA 1ª - DO OBJETO', 'Texto da cláusula 1.']);
    const { texto } = await extrairTextoDeArquivo(buffer, MIME_AGEITOS.odt);
    expect(texto.split('\n')).toEqual(['Preâmbulo do contrato.', 'CLÁUSULA 1ª - DO OBJETO', 'Texto da cláusula 1.']);
  });

  it('decodifica entidades XML dentro do texto', async () => {
    const buffer = await construirOdtFalso(['A &amp; B &lt;C&gt;']);
    const { texto } = await extrairTextoDeArquivo(buffer, MIME_AGEITOS.odt);
    expect(texto).toBe('A & B <C>');
  });

  it('rejeita um .odt sem content.xml', async () => {
    const zip = new JSZip();
    zip.file('nada.txt', 'x');
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    await expect(extrairTextoDeArquivo(buffer, MIME_AGEITOS.odt)).rejects.toThrow(ArquivoInvalidoError);
  });
});

describe('extrairTextoDeArquivo — validações', () => {
  it('rejeita mime não suportado', async () => {
    await expect(extrairTextoDeArquivo(Buffer.from('x'), 'text/plain')).rejects.toThrow(/não suportado/);
  });

  it('rejeita arquivo maior que 20MB', async () => {
    const bufferGrande = Buffer.alloc(20 * 1024 * 1024 + 1);
    await expect(extrairTextoDeArquivo(bufferGrande, MIME_AGEITOS.odt)).rejects.toThrow(/20 ?MB/);
  });
});
