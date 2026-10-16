import { describe, expect, it } from 'vitest';
import { converterApontamentos } from '@/lib/fichas/analise';
import type { SaidaAnalise } from '@/lib/fichas/esquema';
import type { FichaConhecimento } from '@/types/database.types';

const TEXTO = 'CLÁUSULA 1. O prazo da locação será de 90 meses.\nCLÁUSULA 2. O aluguel será reajustado anualmente.';

const FICHAS = [{ id: 'f1', titulo: 'Locação | residencial | locador' }] as FichaConhecimento[];

function ap(parcial: Partial<SaidaAnalise['apontamentos'][number]>): SaidaAnalise['apontamentos'][number] {
  return {
    clausula_numero: '1',
    acao: 'substituir',
    trecho: 'O prazo da locação será de 90 meses.',
    sugestao: 'O prazo da locação será de 30 meses.',
    justificativa: 'Prazo acima do inaceitável.',
    severidade: 'alta',
    origem_ficha: 'Locação | residencial | locador',
    origem_item: 'POSIÇÕES, prazo',
    categoria_ficha: 'posicao',
    ...parcial,
  };
}

describe('converterApontamentos', () => {
  it('ancora o trecho, entra como contexto de negócio e cita a origem', () => {
    const { candidatos, descartados } = converterApontamentos({ apontamentos: [ap({})] }, TEXTO, FICHAS);
    expect(descartados).toBe(0);
    expect(candidatos).toHaveLength(1);
    const c = candidatos[0];
    expect(c.categoria).toBe('caso_cliente_generico');
    expect(c.natureza).toBe('contexto_negocio');
    expect(TEXTO.slice(c.offset_inicio, c.offset_fim)).toBe('O prazo da locação será de 90 meses.');
    expect(c.justificativa).toContain('Origem: Locação | residencial | locador, POSIÇÕES, prazo.');
    expect(c.fonte_inferencia).toMatchObject({ tipo: 'ficha', referencia_id: 'f1', acao: 'substituir' });
  });

  it('descarta apontamento cujo trecho não existe na minuta', () => {
    const { candidatos, descartados } = converterApontamentos(
      { apontamentos: [ap({ trecho: 'O prazo será de 120 meses.' }), ap({})] },
      TEXTO,
      FICHAS
    );
    expect(candidatos).toHaveLength(1);
    expect(descartados).toBe(1);
  });

  it('cláusula ausente vira ponto de inserção após a âncora, sem trecho a substituir', () => {
    const { candidatos } = converterApontamentos(
      {
        apontamentos: [
          ap({ acao: 'inserir', trecho: 'CLÁUSULA 1. O prazo da locação será de 90 meses.', sugestao: 'CLÁUSULA 3. Garantia.', categoria_ficha: 'obrigatoria_ausente' }),
        ],
      },
      TEXTO,
      FICHAS
    );
    const c = candidatos[0];
    expect(c.trecho_original).toBe('');
    expect(c.offset_inicio).toBe(c.offset_fim);
    expect(TEXTO.slice(0, c.offset_inicio).endsWith('90 meses.')).toBe(true);
  });

  it('cláusula ausente sem âncora entra no fim do texto', () => {
    const { candidatos } = converterApontamentos({ apontamentos: [ap({ acao: 'inserir', trecho: '', sugestao: 'Garantia.' })] }, TEXTO, FICHAS);
    expect(candidatos[0].offset_inicio).toBe(TEXTO.length);
  });

  it('remove apontamentos duplicados', () => {
    const { candidatos } = converterApontamentos({ apontamentos: [ap({}), ap({})] }, TEXTO, FICHAS);
    expect(candidatos).toHaveLength(1);
  });

  it('informativo guarda a ação para a tela bloquear o "aplicar"', () => {
    const { candidatos } = converterApontamentos(
      { apontamentos: [ap({ acao: 'informativo', severidade: 'baixa', sugestao: 'Confirmar decisão do cliente.' })] },
      TEXTO,
      FICHAS
    );
    expect(candidatos[0].fonte_inferencia.acao).toBe('informativo');
  });
});
