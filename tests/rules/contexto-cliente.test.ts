import { describe, expect, it } from 'vitest';
import { executarHeuristicasDeContextoCliente } from '@/lib/rules/contexto-cliente/heuristicas';
import type { Cliente, ClienteContratoAnterior } from '@/types/database.types';

function cliente(overrides: Partial<Cliente>): Cliente {
  return {
    id: 'cliente-1',
    nome: 'Cliente Exemplo',
    tipo: 'empresa',
    documento_identificacao: null,
    estrutura_societaria: {},
    notas_operacao: null,
    preferencias_negociadas: {},
    google_drive_folder_id: null,
    clickup_client_id: null,
    ativo: true,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
    ...overrides,
  };
}

describe('executarHeuristicasDeContextoCliente', () => {
  it('sinaliza representação comercial genérica quando o cliente opera por agentes com carteira própria', () => {
    const texto =
      'CLÁUSULA 1 - DO OBJETO\nO PARCEIRO atuará como representante comercial dos produtos da CONTRATANTE.';
    const c = cliente({ preferencias_negociadas: { remuneracao_por_volume: true } });

    const candidatos = executarHeuristicasDeContextoCliente(texto, c, []);
    expect(candidatos).toHaveLength(1);
    expect(candidatos[0].fonte_inferencia.tipo).toBe('cadastro_cliente');
    expect(candidatos[0].clausula_numero).toBe('1');
  });

  it('não sinaliza representação comercial quando a cláusula já reflete remuneração por volume', () => {
    const texto = 'CLÁUSULA 1 - DO OBJETO\nO PARCEIRO atuará como representante comercial com remuneração por volume de vendas.';
    const c = cliente({ preferencias_negociadas: { remuneracao_por_volume: true } });
    expect(executarHeuristicasDeContextoCliente(texto, c, [])).toHaveLength(0);
  });

  it('sinaliza responsabilidade pessoal do parceiro quando a base é majoritariamente PJ', () => {
    const texto = 'CLÁUSULA 5 - DA RESPONSABILIDADE\nO Parceiro responderá pessoal e ilimitadamente por qualquer dano.';
    const c = cliente({ preferencias_negociadas: { percentual_socios_pj: 0.7 } });
    const candidatos = executarHeuristicasDeContextoCliente(texto, c, []);
    expect(candidatos).toHaveLength(1);
    expect(candidatos[0].justificativa).toContain('70%');
  });

  it('sinaliza cessão de quotas livre quando a holding tem trava de incessibilidade', () => {
    const texto = 'CLÁUSULA 8 - DAS QUOTAS\nA cessão de quotas a terceiros é permitida independentemente de anuência dos demais sócios.';
    const c = cliente({
      tipo: 'holding',
      preferencias_negociadas: { trava_incessibilidade: true },
      estrutura_societaria: { clausula_trava_incessibilidade: 'Art. 12 do contrato social: cessão depende de anuência unânime.' },
    });
    const candidatos = executarHeuristicasDeContextoCliente(texto, c, []);
    expect(candidatos).toHaveLength(1);
    expect(candidatos[0].fonte_inferencia.tipo).toBe('clausula_contrato_social');
  });

  it('não sinaliza cessão de quotas quando o cliente não tem trava de incessibilidade', () => {
    const texto = 'CLÁUSULA 8 - DAS QUOTAS\nA cessão de quotas a terceiros é permitida independentemente de anuência dos demais sócios.';
    const c = cliente({ tipo: 'holding', preferencias_negociadas: { trava_incessibilidade: false } });
    expect(executarHeuristicasDeContextoCliente(texto, c, [])).toHaveLength(0);
  });

  it('sinaliza prazo de sigilo abaixo do mínimo negociado, citando contrato anterior como fonte', () => {
    const texto = 'CLÁUSULA 9 - DA CONFIDENCIALIDADE\nAs partes guardarão sigilo pelo prazo de 2 (dois) anos após o término.';
    const c = cliente({
      preferencias_negociadas: { dados_comerciais_sensiveis: true, prazo_sigilo_minimo_meses: 48 },
    });
    const contratosAnteriores: ClienteContratoAnterior[] = [
      {
        id: 'contrato-1',
        cliente_id: c.id,
        tipo_peca_id: 'tipo-1',
        documento_id: null,
        fonte: 'google_drive',
        referencia_externa: 'drive-xyz',
        resumo_clausulas: { prazo_sigilo_meses: 48 },
        data_documento: null,
        criado_em: new Date().toISOString(),
      },
    ];

    const candidatos = executarHeuristicasDeContextoCliente(texto, c, contratosAnteriores);
    expect(candidatos).toHaveLength(1);
    expect(candidatos[0].fonte_inferencia.tipo).toBe('contrato_anterior');
    expect(candidatos[0].fonte_inferencia.referencia_id).toBe('contrato-1');
  });

  it('não sinaliza prazo de sigilo quando já atende ao mínimo', () => {
    const texto = 'CLÁUSULA 9 - DA CONFIDENCIALIDADE\nAs partes guardarão sigilo pelo prazo de 5 anos após o término.';
    const c = cliente({ preferencias_negociadas: { dados_comerciais_sensiveis: true, prazo_sigilo_minimo_meses: 48 } });
    expect(executarHeuristicasDeContextoCliente(texto, c, [])).toHaveLength(0);
  });
});
