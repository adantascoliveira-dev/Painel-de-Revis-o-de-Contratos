import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { gerarDocxDocumento, gerarPdfDocumento } from '@/lib/services/exportacao';

const dados = {
  titulo: 'Contrato de prestação de serviços',
  subtitulo: 'Cliente X · v1',
  texto: 'CLÁUSULA 1ª. OBJETO\n1.1. Serviços de consultoria.',
};
const anexo = { titulo: 'Protocolo de Gestão', texto: 'ORIENTAÇÕES PARA QUEM TRABALHA COM PRESTADORES\n- Peça por escrito.' };

async function textoDoDocx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  return (await zip.file('word/document.xml')!.async('string')).replace(/<[^>]+>/g, ' ');
}

describe('exportação com anexos do modelo', () => {
  it('docx leva o anexo depois do texto, em página própria', async () => {
    const xml = await textoDoDocx(await gerarDocxDocumento({ ...dados, anexos: [anexo] }));
    expect(xml).toContain('Serviços de consultoria');
    expect(xml).toContain('Protocolo de Gestão');
    expect(xml.indexOf('Protocolo de Gestão')).toBeGreaterThan(xml.indexOf('Serviços de consultoria'));
  });

  it('docx sem anexos não leva o protocolo', async () => {
    expect(await textoDoDocx(await gerarDocxDocumento(dados))).not.toContain('Protocolo de Gestão');
  });

  it('pdf ganha uma página a mais por anexo', async () => {
    const sem = await PDFDocument.load(await gerarPdfDocumento(dados));
    const com = await PDFDocument.load(await gerarPdfDocumento({ ...dados, anexos: [anexo] }));
    expect(com.getPageCount()).toBe(sem.getPageCount() + 1);
  });
});
