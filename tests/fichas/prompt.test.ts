import { describe, expect, it } from 'vitest';
import { montarSystemPrompt } from '@/lib/fichas/prompt';
import type { FichaConhecimento } from '@/types/database.types';

function ficha(parcial: Partial<FichaConhecimento>): FichaConhecimento {
  return {
    id: 'f', escopo: 'tipo', titulo: 'Ficha X', tipo_peca_id: 't', subtipo: null, polo: null, cliente_id: null,
    conteudo_md: 'POSIÇÕES:\n- [objeto] PADRÃO: x\nEM ABERTO: segredo pendente\nVALIDADO POR: Anderson',
    validada_por: null, validada_em: '2026-10-16', ativa: true, criado_em: '', atualizado_em: '', ...parcial,
  };
}

describe('montarSystemPrompt', () => {
  it('inclui a ficha sem a seção EM ABERTO', () => {
    const prompt = montarSystemPrompt({ tipo: ficha({}), cliente: [], transversais: [] });
    expect(prompt).toContain('[FICHA POR TIPO] Ficha X');
    expect(prompt).toContain('PADRÃO: x');
    expect(prompt).not.toContain('segredo pendente');
  });

  it('avisa que não há ficha por tipo e mantém as de cliente e transversais', () => {
    const prompt = montarSystemPrompt({
      tipo: null,
      cliente: [ficha({ escopo: 'cliente', titulo: 'Clap' })],
      transversais: [ficha({ escopo: 'transversal', titulo: 'Soma de prazos' })],
    });
    expect(prompt).toContain('Sem ficha validada para este tipo de peça, subtipo e polo.');
    expect(prompt).toContain('[FICHA DE CLIENTE] Clap');
    expect(prompt).toContain('[ALERTAS TRANSVERSAIS] Soma de prazos');
  });

  it('carrega a precedência e a regra de não inventar posição', () => {
    const prompt = montarSystemPrompt({ tipo: null, cliente: [], transversais: [] });
    expect(prompt).toContain('PREVALECE');
    expect(prompt).toContain('não invente posição');
  });
});
