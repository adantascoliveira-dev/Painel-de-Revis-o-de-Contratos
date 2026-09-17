import { describe, expect, it } from 'vitest';
import { extrairClausulas, separarPreambulo } from '@/lib/extracao/clausulas';

describe('extrairClausulas', () => {
  it('separa preâmbulo e cláusulas numeradas no estilo "CLÁUSULA N - Título"', () => {
    const texto =
      'Pelas partes abaixo qualificadas.\n\n' +
      'CLÁUSULA 1ª - DO OBJETO\nO objeto deste contrato é a prestação de serviços.\n\n' +
      'CLÁUSULA 2ª - DO PREÇO\nO preço será de R$ 1.000,00 mensais.';

    const clausulas = extrairClausulas(texto);
    expect(clausulas).toHaveLength(3);
    expect(clausulas[0].numero).toBeNull();
    expect(clausulas[1].numero).toBe('1');
    expect(clausulas[1].titulo).toBe('DO OBJETO');
    expect(clausulas[2].numero).toBe('2');

    for (const clausula of clausulas) {
      expect(texto.slice(clausula.offset_inicio, clausula.offset_fim)).toBe(clausula.texto);
    }
  });

  it('reconhece numeração decimal ("3.2 Título")', () => {
    const texto = '3. DAS OBRIGAÇÕES\nTexto da cláusula 3.\n3.2 Reajuste anual\nTexto da subcláusula.';
    const clausulas = extrairClausulas(texto);
    expect(clausulas.map((c) => c.numero)).toEqual(['3', '3.2']);
  });

  it('reconhece ordinais por extenso ("CLÁUSULA SEGUNDA", "CLÁUSULA DÉCIMA PRIMEIRA")', () => {
    const texto =
      'CLÁUSULA SEGUNDA — DO OBJETO\n2.1. Texto do objeto.\n' +
      'CLÁUSULA DÉCIMA PRIMEIRA — DISPOSIÇÕES GERAIS\n11.1. Texto final.';
    const clausulas = extrairClausulas(texto);
    expect(clausulas.map((c) => c.numero)).toEqual(['2', '2.1', '11', '11.1']);
    expect(clausulas[0].titulo).toBe('DO OBJETO');
    expect(clausulas[2].titulo).toBe('DISPOSIÇÕES GERAIS');
  });

  it('devolve o texto inteiro como uma única cláusula quando não há numeração reconhecível', () => {
    const texto = 'Um texto qualquer sem nenhuma marcação de cláusula.';
    const clausulas = extrairClausulas(texto);
    expect(clausulas).toEqual([{ numero: null, titulo: null, texto, offset_inicio: 0, offset_fim: texto.length }]);
  });
});

describe('separarPreambulo', () => {
  it('encontra a fronteira no primeiro cabeçalho de cláusula', () => {
    const texto = 'Preâmbulo aqui.\nCLÁUSULA 1ª - DO OBJETO\nResto do contrato.';
    const { preambulo, corpo } = separarPreambulo(texto);
    expect(preambulo).toBe('Preâmbulo aqui.\n');
    expect(corpo.startsWith('CLÁUSULA 1ª')).toBe(true);
  });
});
