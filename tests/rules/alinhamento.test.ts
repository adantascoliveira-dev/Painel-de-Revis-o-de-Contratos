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

describe('alinharClausulas com cláusula condicional omitida (renumeração por título)', () => {
  const c = (numero: string | null, titulo: string | null, texto: string) => ({ numero, titulo, texto, offset_inicio: 0, offset_fim: texto.length });

  const modelo = [
    c('1', 'OBJETO', 'CLÁUSULA 1ª. OBJETO'),
    c('1.1', null, '1.1. Objeto.'),
    c('9', 'PROPRIEDADE INTELECTUAL [incluir quando o serviço gerar obra protegida]', 'CLÁUSULA 9ª. PROPRIEDADE INTELECTUAL'),
    c('9.1', null, '9.1. Cessão.'),
    c('10', 'PROTEÇÃO DE DADOS', 'CLÁUSULA 10ª. PROTEÇÃO DE DADOS'),
    c('10.1', null, '10.1. Operadora.'),
    c('11', 'CLÁUSULA PENAL', 'CLÁUSULA 11ª. CLÁUSULA PENAL'),
    c('11.1', null, '11.1. Multa.'),
  ];

  it('minuta sem a cláusula 9 não deixa o fim do modelo "ausente": pareia pelo título', () => {
    const minuta = [
      c('1', 'DO OBJETO', 'CLÁUSULA 1ª. DO OBJETO'),
      c('1.1', null, '1.1. Objeto.'),
      c('9', 'PROTEÇÃO DE DADOS', 'CLÁUSULA 9ª. PROTEÇÃO DE DADOS'),
      c('9.1', null, '9.1. Operadora.'),
      c('10', 'CLÁUSULA PENAL', 'CLÁUSULA 10ª. CLÁUSULA PENAL'),
      c('10.1', null, '10.1. Multa.'),
    ];
    const pares = alinharClausulas(modelo, minuta);
    const semPar = pares.filter((p) => p.clausulaModelo && !p.clausulaMinuta).map((p) => p.numero);
    expect(semPar).toEqual(['9', '9.1']);
    const protecao = pares.find((p) => p.numero === '10');
    expect(protecao?.clausulaMinuta?.texto).toContain('PROTEÇÃO DE DADOS');
  });

  it('não renumera quando a numeração já bate com a do modelo', () => {
    const pares = alinharClausulas(modelo, modelo);
    expect(pares.every((p) => p.origemAlinhamento === 'numero')).toBe(true);
  });
});
