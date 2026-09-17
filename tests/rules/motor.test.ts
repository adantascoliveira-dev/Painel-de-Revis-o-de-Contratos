import { describe, expect, it } from 'vitest';
import { detectarClausulasAusentes, detectarConflitosEntreRegras, executarMotorDeEstilo } from '@/lib/rules/estilo/motor';
import type { Clausula, RegraEstilo } from '@/types/database.types';

function regra(overrides: Partial<RegraEstilo>): RegraEstilo {
  return {
    id: overrides.id ?? 'regra-1',
    guia_estilo_id: 'guia-1',
    categoria: 'juridiques_excesso',
    nome: 'Regra de teste',
    padrao_deteccao: { tipo: 'regex_lista', flags: 'gi', padroes: [] },
    texto_orientacao: 'orientação',
    exemplo_antes: null,
    exemplo_depois: null,
    severidade_default: 'media',
    ativo: true,
    criado_em: new Date().toISOString(),
    ...overrides,
  };
}

describe('executarMotorDeEstilo — categorias 1-4 (regex)', () => {
  it('detecta um termo simples e usa o substituto literal como sugestão', () => {
    const regras = [
      regra({
        padrao_deteccao: { tipo: 'regex_lista', flags: 'gi', padroes: [{ regex: '\\boutrossim\\b', substituto: 'além disso' }] },
      }),
    ];
    const texto = 'As partes concordam. Outrossim, o prazo é de 12 meses.';
    const [sinalizacao] = executarMotorDeEstilo(texto, regras);

    expect(sinalizacao.trecho_original).toBe('Outrossim');
    expect(sinalizacao.sugestao_ajuste).toBe('além disso');
    expect(sinalizacao.natureza).toBe('estilo');
    expect(texto.slice(sinalizacao.offset_inicio, sinalizacao.offset_fim)).toBe('Outrossim');
  });

  it('interpola grupos capturados ($1) no substituto, preservando gênero', () => {
    const regras = [
      regra({
        padrao_deteccao: {
          tipo: 'regex_lista',
          flags: 'gi',
          padroes: [{ regex: '(nul[oa])\\s+e\\s+sem\\s+nenhum\\s+efeito\\b', substituto: '$1' }],
        },
      }),
    ];
    const texto = 'A cláusula é nula e sem nenhum efeito perante terceiros.';
    const [sinalizacao] = executarMotorDeEstilo(texto, regras);
    expect(sinalizacao.sugestao_ajuste).toBe('nula');
  });

  it('não deixa duas regras marcarem o mesmo trecho sobreposto (mantém a primeira por posição)', () => {
    const regras = [
      regra({
        id: 'r1',
        padrao_deteccao: { tipo: 'regex_lista', flags: 'gi', padroes: [{ regex: 'atraso\\s+no\\s+repasse', substituto: 'atraso' }] },
      }),
      regra({
        id: 'r2',
        categoria: 'tom_culpa',
        padrao_deteccao: { tipo: 'regex_lista', flags: 'gi', padroes: [{ regex: 'no\\s+repasse\\s+das\\s+informações', substituto: 'x' }] },
      }),
    ];
    const texto = 'O atraso no repasse das informações gerará multa.';
    const candidatos = executarMotorDeEstilo(texto, regras);
    expect(candidatos).toHaveLength(1);
    expect(candidatos[0].regra_estilo_id).toBe('r1');
  });

  it('ignora regras inativas', () => {
    const regras = [
      regra({ ativo: false, padrao_deteccao: { tipo: 'regex_lista', flags: 'gi', padroes: [{ regex: 'destarte', substituto: 'assim' }] } }),
    ];
    expect(executarMotorDeEstilo('Destarte, nada muda.', regras)).toHaveLength(0);
  });
});

describe('detectarConflitosEntreRegras', () => {
  it('reporta um conflito quando duas regras diferentes casam em trechos sobrepostos', () => {
    const regras = [
      regra({
        id: 'r1',
        padrao_deteccao: { tipo: 'regex_lista', flags: 'gi', padroes: [{ regex: 'atraso\\s+no\\s+repasse', substituto: 'a' }] },
      }),
      regra({
        id: 'r2',
        categoria: 'tom_culpa',
        padrao_deteccao: { tipo: 'regex_lista', flags: 'gi', padroes: [{ regex: 'no\\s+repasse\\s+das\\s+informações', substituto: 'b' }] },
      }),
    ];
    const texto = 'O atraso no repasse das informações gerará multa.';
    const conflitos = detectarConflitosEntreRegras(texto, regras);
    expect(conflitos).toHaveLength(1);
    expect(conflitos[0].map((c) => c.regra_estilo_id).sort()).toEqual(['r1', 'r2']);
  });

  it('não reporta conflito entre candidatos da mesma regra nem entre trechos que não se sobrepõem', () => {
    const regras = [
      regra({
        id: 'r1',
        padrao_deteccao: {
          tipo: 'regex_lista',
          flags: 'gi',
          padroes: [{ regex: 'outrossim', substituto: 'além disso' }],
        },
      }),
    ];
    expect(detectarConflitosEntreRegras('Outrossim, outrossim.', regras)).toHaveLength(0);
  });
});

describe('executarMotorDeEstilo — categoria 4 (qualificação do preâmbulo repetida)', () => {
  it('sinaliza um trecho do corpo que repete uma qualificação longa do preâmbulo', () => {
    const preambulo =
      'Pelo presente instrumento, de um lado ACME PARTICIPAÇÕES LTDA, sociedade empresária limitada, inscrita no CNPJ sob o número 12.345.678/0001-90, com sede na Rua das Flores, 100, doravante denominada simplesmente CONTRATANTE, e de outro lado JOÃO DA SILVA, brasileiro, casado, portador do RG 1.234.567.\n\n';
    const corpo =
      'CLÁUSULA 1 - DO OBJETO\nACME PARTICIPAÇÕES LTDA, sociedade empresária limitada, inscrita no CNPJ sob o número 12.345.678/0001-90, com sede na Rua das Flores, 100, se compromete a prestar os serviços descritos no Anexo I.';
    const texto = preambulo + corpo;

    const regras = [regra({ categoria: 'ruido_informacao_desnecessaria', padrao_deteccao: { tipo: 'similaridade_preambulo', limiar: 0.6 } })];
    const candidatos = executarMotorDeEstilo(texto, regras);

    expect(candidatos.length).toBeGreaterThan(0);
    const trecho = candidatos[0].trecho_original;
    expect(trecho).toContain('ACME PARTICIPAÇÕES LTDA');
    expect(trecho.length).toBeGreaterThan(30);
  });

  it('não sinaliza nada quando o corpo não repete o preâmbulo', () => {
    const preambulo = 'ACME PARTICIPAÇÕES LTDA e JOÃO DA SILVA, qualificados no preâmbulo.\n\n';
    const corpo = 'CLÁUSULA 1 - DO OBJETO\nA CONTRATANTE pagará à CONTRATADA o valor mensal de R$ 5.000,00.';
    const regras = [regra({ categoria: 'ruido_informacao_desnecessaria', padrao_deteccao: { tipo: 'similaridade_preambulo', limiar: 0.6 } })];
    expect(executarMotorDeEstilo(preambulo + corpo, regras)).toHaveLength(0);
  });
});

describe('detectarClausulasAusentes — categoria 6', () => {
  const regraClausulasAusentes = regra({ categoria: 'clausulas_ausentes', padrao_deteccao: { tipo: 'comparacao_com_modelo' } });

  function clausula(numero: string, texto: string, offset: number): Clausula {
    return { numero, titulo: null, texto, offset_inicio: offset, offset_fim: offset + texto.length };
  }

  it('sinaliza uma cláusula do modelo que não existe na minuta, ancorada logo após a cláusula anterior', () => {
    const clausulasModelo = [
      clausula('1', 'CLÁUSULA 1 texto do objeto', 0),
      clausula('2', 'CLÁUSULA 2 texto de confidencialidade', 30),
      clausula('3', 'CLÁUSULA 3 texto de foro', 70),
    ];
    const clausulasMinuta = [
      clausula('1', 'CLAUSULA 1 versão da minuta', 0),
      clausula('3', 'CLAUSULA 3 versão da minuta', 28),
    ];

    const candidatos = detectarClausulasAusentes(clausulasModelo, clausulasMinuta, regraClausulasAusentes);
    expect(candidatos).toHaveLength(1);
    expect(candidatos[0].categoria).toBe('clausulas_ausentes');
    expect(candidatos[0].offset_inicio).toBe(candidatos[0].offset_fim);
    expect(candidatos[0].offset_inicio).toBe(clausulasMinuta[0].offset_fim);
    expect(candidatos[0].sugestao_ajuste).toContain('confidencialidade');
  });

  it('não sinaliza nada quando todas as cláusulas do modelo têm par na minuta', () => {
    const clausulasModelo = [clausula('1', 'texto', 0)];
    const clausulasMinuta = [clausula('1', 'texto', 0)];
    expect(detectarClausulasAusentes(clausulasModelo, clausulasMinuta, regraClausulasAusentes)).toHaveLength(0);
  });

  it('não faz nada sem modelo (lista vazia)', () => {
    expect(detectarClausulasAusentes([], [clausula('1', 'texto', 0)], regraClausulasAusentes)).toHaveLength(0);
  });
});
