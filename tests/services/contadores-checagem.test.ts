import { describe, expect, it } from 'vitest';
import { calcularContadoresChecagem } from '@/lib/services/sinalizacoes';
import type { Sinalizacao } from '@/types/database.types';

function sinalizacao(overrides: Partial<Sinalizacao>): Sinalizacao {
  return {
    id: Math.random().toString(),
    documento_id: 'doc-1',
    clausula_numero: null,
    trecho_original: 'x',
    offset_inicio: 0,
    offset_fim: 1,
    categoria: 'juridiques_excesso',
    natureza: 'estilo',
    sugestao_ajuste: 'y',
    justificativa: 'z',
    severidade: 'baixa',
    fonte_inferencia: null,
    regra_estilo_id: 'r1',
    resolucao: 'pendente',
    resolvido_por: null,
    resolvido_em: null,
    texto_sugestao_editado: null,
    criado_em: new Date().toISOString(),
    ...overrides,
  };
}

describe('calcularContadoresChecagem', () => {
  it('conta desvios de estilo em aberto, pontos de contexto pendentes e ajustes aplicados', () => {
    const sinalizacoes = [
      sinalizacao({ natureza: 'estilo', resolucao: 'pendente' }),
      sinalizacao({ natureza: 'estilo', resolucao: 'aplicada' }),
      sinalizacao({ natureza: 'estilo', resolucao: 'mantida' }),
      sinalizacao({ natureza: 'contexto_negocio', categoria: 'caso_cliente_generico', resolucao: 'pendente' }),
    ];
    const contadores = calcularContadoresChecagem(sinalizacoes);
    expect(contadores.desviosEmAberto).toBe(1);
    expect(contadores.ajustesAplicados).toBe(1);
    expect(contadores.pontosDeContexto).toBe(1);
    expect(contadores.percentualAderencia).toBe(67); // 2 de 3 sinalizações de estilo resolvidas
  });

  it('aderência é 100% quando não há nenhum desvio de estilo detectado', () => {
    const contadores = calcularContadoresChecagem([]);
    expect(contadores.percentualAderencia).toBe(100);
  });
});
