import { describe, expect, it } from 'vitest';
import { derivarPontosDeJulgamentoHumano } from '@/lib/services/pontos-julgamento-humano';
import type { Documento, RegraEstilo, Sinalizacao } from '@/types/database.types';

function documento(texto: string): Documento {
  return {
    id: 'doc-1',
    titulo: 'Minuta',
    arquivo_original_path: null,
    arquivo_original_nome: null,
    arquivo_original_mime: null,
    arquivo_original_tamanho_bytes: null,
    texto_extraido: texto,
    texto_trabalho: texto,
    clausulas: [],
    tipo_peca_id: 'tipo-1',
    cliente_id: 'cliente-1',
    autor_id: 'autor-1',
    socio_revisor_id: 'socio-1',
    modelo_aprovado_id: null,
    status: 'aguardando_socio',
    versao: 1,
    documento_pai_id: null,
    categorias_checagem_habilitadas: [],
    clickup_task_id: null,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  };
}

function sinalizacaoContexto(overrides: Partial<Sinalizacao>): Sinalizacao {
  return {
    id: 's1',
    documento_id: 'doc-1',
    clausula_numero: '3',
    trecho_original: 'trecho',
    offset_inicio: 0,
    offset_fim: 5,
    categoria: 'caso_cliente_generico',
    natureza: 'contexto_negocio',
    sugestao_ajuste: 'ajuste',
    justificativa: 'justificativa',
    severidade: 'alta',
    fonte_inferencia: { tipo: 'cadastro_cliente', detalhe: 'x' },
    regra_estilo_id: null,
    resolucao: 'pendente',
    resolvido_por: null,
    resolvido_em: null,
    texto_sugestao_editado: null,
    criado_em: new Date().toISOString(),
    ...overrides,
  };
}

describe('derivarPontosDeJulgamentoHumano', () => {
  it('toda sinalização de contexto de negócio pendente vira ponto de contradição de histórico', () => {
    const pontos = derivarPontosDeJulgamentoHumano({
      documento: documento('texto qualquer'),
      sinalizacoesPendentes: [sinalizacaoContexto({})],
      modeloAprovado: null,
      contratosAnteriores: [],
      regrasEstiloAtivas: [],
    });
    expect(pontos).toHaveLength(1);
    expect(pontos[0].razao).toBe('contradicao_historico');
  });

  it('detecta cláusula de foro como decisão comercial e agrega o que os contratos anteriores fizeram', () => {
    const texto = 'CLÁUSULA 10 - DO FORO\nFica eleito o foro da comarca de São Paulo/SP para dirimir controvérsias.';
    const pontos = derivarPontosDeJulgamentoHumano({
      documento: documento(texto),
      sinalizacoesPendentes: [],
      modeloAprovado: null,
      contratosAnteriores: [
        { resumo_clausulas: { foro: 'São Paulo/SP' } },
        { resumo_clausulas: { foro: 'São Paulo/SP' } },
        { resumo_clausulas: { foro: 'Rio de Janeiro/RJ' } },
      ],
      regrasEstiloAtivas: [],
    });

    expect(pontos).toHaveLength(1);
    expect(pontos[0].razao).toBe('decisao_comercial');
    expect(pontos[0].contexto.o_que_contratos_anteriores_fizeram).toEqual([
      { valor: 'São Paulo/SP', ocorrencias: 2 },
      { valor: 'Rio de Janeiro/RJ', ocorrencias: 1 },
    ]);
  });

  it('não duplica um ponto de decisão comercial já coberto por uma sinalização pendente', () => {
    const texto = 'CLÁUSULA 10 - DO FORO\nFica eleito o foro da comarca de São Paulo/SP.';
    const offsetForo = texto.indexOf('foro da comarca');
    const pontos = derivarPontosDeJulgamentoHumano({
      documento: documento(texto),
      sinalizacoesPendentes: [
        sinalizacaoContexto({ offset_inicio: offsetForo, offset_fim: offsetForo + 10 }),
      ],
      modeloAprovado: null,
      contratosAnteriores: [],
      regrasEstiloAtivas: [],
    });
    expect(pontos.filter((p) => p.razao === 'decisao_comercial')).toHaveLength(0);
  });

  it('detecta conflito entre regras do guia no mesmo trecho', () => {
    const texto = 'O atraso no repasse das informações gerará multa.';
    const regras: RegraEstilo[] = [
      {
        id: 'r1',
        guia_estilo_id: 'g1',
        categoria: 'juridiques_excesso',
        nome: 'Regra 1',
        padrao_deteccao: { tipo: 'regex_lista', flags: 'gi', padroes: [{ regex: 'atraso\\s+no\\s+repasse', substituto: 'a' }] as never },
        texto_orientacao: 'orientação 1',
        exemplo_antes: null,
        exemplo_depois: null,
        severidade_default: 'baixa',
        ativo: true,
        criado_em: new Date().toISOString(),
      },
      {
        id: 'r2',
        guia_estilo_id: 'g1',
        categoria: 'tom_culpa',
        nome: 'Regra 2',
        padrao_deteccao: {
          tipo: 'regex_lista',
          flags: 'gi',
          padroes: [{ regex: 'no\\s+repasse\\s+das\\s+informações', substituto: 'b' }] as never,
        },
        texto_orientacao: 'orientação 2',
        exemplo_antes: null,
        exemplo_depois: null,
        severidade_default: 'alta',
        ativo: true,
        criado_em: new Date().toISOString(),
      },
    ];

    const pontos = derivarPontosDeJulgamentoHumano({
      documento: documento(texto),
      sinalizacoesPendentes: [],
      modeloAprovado: null,
      contratosAnteriores: [],
      regrasEstiloAtivas: regras,
    });
    expect(pontos.filter((p) => p.razao === 'conflito_regras')).toHaveLength(1);
  });
});
