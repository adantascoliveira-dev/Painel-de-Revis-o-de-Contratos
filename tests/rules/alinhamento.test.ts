import { describe, expect, it } from 'vitest';
import { alinharClausulas } from '@/lib/extracao/alinhamento';
import type { Clausula } from '@/types/database.types';

function clausula(numero: string | null, offset = 0): Clausula {
  return { numero, titulo: null, texto: `texto ${numero}`, offset_inicio: offset, offset_fim: offset + 10 };
}

describe('alinharClausulas', () => {
  it('alinha por número mesmo quando a minuta está incompleta em relação ao modelo', () => {
    const modelo = [clausula('1'), clausula('2'), clausula('3')];
    const minuta = [clausula('1'), clausula('3')];

    const pares = alinharClausulas(modelo, minuta);
    expect(pares.every((p) => p.origemAlinhamento !== 'posicao')).toBe(true);

    const par2 = pares.find((p) => p.numero === '2');
    expect(par2?.clausulaMinuta).toBeNull();
    expect(par2?.origemAlinhamento).toBe('sem_par');
  });

  it('cai para alinhamento posicional quando a minuta usa numeração que o modelo não conhece', () => {
    const modelo = [clausula('1'), clausula('2')];
    const minuta = [clausula('1'), clausula('99')];

    const pares = alinharClausulas(modelo, minuta);
    expect(pares.some((p) => p.origemAlinhamento === 'posicao')).toBe(true);
  });

  it('marca cláusula nova da minuta (sem correspondente no modelo) como sem_par', () => {
    const modelo = [clausula('1')];
    const minuta = [clausula('1'), clausula('1.1')];

    const pares = alinharClausulas(modelo, minuta);
    const nova = pares.find((p) => p.numero === '1.1');
    expect(nova?.clausulaModelo).toBeNull();
    expect(nova?.origemAlinhamento).toBe('sem_par');
  });
});
