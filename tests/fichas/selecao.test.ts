import { describe, expect, it } from 'vitest';
import { selecionarFichas, totalDeFichas } from '@/lib/fichas/selecao';
import type { FichaConhecimento } from '@/types/database.types';

const TIPO_LOCACAO = 'tipo-locacao';
const TIPO_OUTRO = 'tipo-outro';
const CLIENTE_CLAP = 'cliente-clap';

function ficha(parcial: Partial<FichaConhecimento>): FichaConhecimento {
  return {
    id: Math.random().toString(36).slice(2),
    escopo: 'tipo',
    titulo: 'ficha',
    tipo_peca_id: TIPO_LOCACAO,
    subtipo: null,
    polo: null,
    cliente_id: null,
    conteudo_md: 'x',
    validada_por: null,
    validada_em: '2026-10-01',
    ativa: true,
    criado_em: '',
    atualizado_em: '',
    ...parcial,
  };
}

const alvo = { tipo_peca_id: TIPO_LOCACAO, cliente_id: CLIENTE_CLAP, subtipo: 'residencial', polo: 'locador' };

describe('selecionarFichas', () => {
  it('exige tipo, subtipo e polo iguais (sem acento nem caixa)', () => {
    const certa = ficha({ titulo: 'residencial locador', subtipo: 'Residencial', polo: 'LOCADOR' });
    const poloErrado = ficha({ titulo: 'residencial locatario', subtipo: 'residencial', polo: 'locatário' });
    const r = selecionarFichas([poloErrado, certa], alvo);
    expect(r.tipo?.titulo).toBe('residencial locador');
  });

  it('sem ficha para o polo, não aproxima: tipo fica nulo', () => {
    const r = selecionarFichas([ficha({ subtipo: 'residencial', polo: 'locatário' })], alvo);
    expect(r.tipo).toBeNull();
    expect(totalDeFichas(r)).toBe(0);
  });

  it('ignora fichas inativas ou não validadas', () => {
    const inativa = ficha({ subtipo: 'residencial', polo: 'locador', ativa: false });
    const naoValidada = ficha({ subtipo: 'residencial', polo: 'locador', validada_em: null });
    expect(selecionarFichas([inativa, naoValidada], alvo).tipo).toBeNull();
  });

  it('inclui ficha de cliente (restrita ao tipo) e descarta a de outro cliente ou tipo', () => {
    const clap = ficha({ escopo: 'cliente', cliente_id: CLIENTE_CLAP, tipo_peca_id: TIPO_LOCACAO, titulo: 'clap locação' });
    const clapGeral = ficha({ escopo: 'cliente', cliente_id: CLIENTE_CLAP, tipo_peca_id: null, titulo: 'clap geral' });
    const outroCliente = ficha({ escopo: 'cliente', cliente_id: 'outro', tipo_peca_id: null });
    const outroTipo = ficha({ escopo: 'cliente', cliente_id: CLIENTE_CLAP, tipo_peca_id: TIPO_OUTRO });
    const r = selecionarFichas([clapGeral, outroCliente, outroTipo, clap], alvo);
    expect(r.cliente.map((f) => f.titulo)).toEqual(['clap locação', 'clap geral']);
  });

  it('transversal vale para o tipo e, se tiver subtipo, só para ele', () => {
    const geral = ficha({ escopo: 'transversal', titulo: 'soma de prazos' });
    const soResidencial = ficha({ escopo: 'transversal', subtipo: 'residencial', titulo: 'caução' });
    const soComercial = ficha({ escopo: 'transversal', subtipo: 'comercial', titulo: 'luvas' });
    const outroTipo = ficha({ escopo: 'transversal', tipo_peca_id: TIPO_OUTRO });
    const r = selecionarFichas([geral, soResidencial, soComercial, outroTipo], alvo);
    expect(r.transversais.map((f) => f.titulo).sort()).toEqual(['caução', 'soma de prazos']);
  });
});
