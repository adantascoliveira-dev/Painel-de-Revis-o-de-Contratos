import { describe, expect, it } from 'vitest';
import { localizarTrecho } from '@/lib/fichas/ancoragem';

const TEXTO = 'CLÁUSULA 1. O prazo\nda locação será de 30 meses.\nCLÁUSULA 2. O aluguel é mensal.';

describe('localizarTrecho', () => {
  it('encontra trecho exato', () => {
    const r = localizarTrecho(TEXTO, 'O aluguel é mensal.');
    expect(r).not.toBeNull();
    expect(TEXTO.slice(r!.inicio, r!.fim)).toBe('O aluguel é mensal.');
  });

  it('tolera diferença de espaços e quebras de linha', () => {
    const r = localizarTrecho(TEXTO, 'O prazo da locação será de 30 meses.');
    expect(r).not.toBeNull();
    expect(TEXTO.slice(r!.inicio, r!.fim)).toBe('O prazo\nda locação será de 30 meses.');
  });

  it('retorna null para trecho que não existe (modelo inventou) ou vazio', () => {
    expect(localizarTrecho(TEXTO, 'O prazo será de 60 meses.')).toBeNull();
    expect(localizarTrecho(TEXTO, '   ')).toBeNull();
  });

  it('escapa caracteres especiais de regex', () => {
    const texto = 'Multa de R$ 1.000,00 (mil reais) [por mês].';
    const r = localizarTrecho(texto, 'R$ 1.000,00  (mil reais)');
    expect(r).not.toBeNull();
  });
});
