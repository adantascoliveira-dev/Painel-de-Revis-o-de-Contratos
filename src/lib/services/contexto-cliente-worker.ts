import type { SupabaseClient } from '@supabase/supabase-js';
import { executarHeuristicasDeContextoCliente } from '@/lib/rules/contexto-cliente/heuristicas';
import type { Cliente, ClienteContratoAnterior, Documento } from '@/types/database.types';

/** Enfileira a análise assíncrona de contexto do cliente (categoria 5) para um documento. */
export async function enfileirarAnaliseContextoCliente(supabase: SupabaseClient, documentoId: string) {
  const { data, error } = await supabase
    .from('analises_contexto_cliente_jobs')
    .insert({ documento_id: documentoId })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Processa um job da fila (categoria 5, assíncrona: cruza a minuta com o
 * cadastro do cliente e o histórico contratual). Deve ser chamada só pelo
 * worker HTTP com o cliente admin (service role) — ver src/app/api/jobs.
 * Devolve null quando não havia nada pendente na fila.
 */
export async function processarProximoJobContextoCliente(adminClient: SupabaseClient) {
  const { data: job, error: erroReivindicar } = await adminClient.rpc('reivindicar_proximo_job_contexto_cliente');
  if (erroReivindicar) throw erroReivindicar;
  if (!job) return null;

  try {
    const { data: documento, error: erroDoc } = await adminClient
      .from('documentos')
      .select('*')
      .eq('id', job.documento_id)
      .single();
    if (erroDoc) throw erroDoc;
    const doc = documento as Documento;

    if (!doc.categorias_checagem_habilitadas.includes('caso_cliente_generico')) {
      await adminClient.rpc('concluir_job_contexto_cliente', {
        p_job_id: job.id,
        p_resultado_resumo: { sinalizacoes_geradas: 0, motivo: 'categoria desabilitada para este documento' },
      });
      return { job, sinalizacoesGeradas: 0 };
    }

    const { data: cliente, error: erroCliente } = await adminClient
      .from('clientes')
      .select('*')
      .eq('id', doc.cliente_id)
      .single();
    if (erroCliente) throw erroCliente;

    const { data: contratosAnteriores, error: erroContratos } = await adminClient
      .from('cliente_contratos_anteriores')
      .select('*')
      .eq('cliente_id', doc.cliente_id)
      .eq('tipo_peca_id', doc.tipo_peca_id);
    if (erroContratos) throw erroContratos;

    const candidatos = executarHeuristicasDeContextoCliente(
      doc.texto_trabalho,
      cliente as Cliente,
      (contratosAnteriores ?? []) as ClienteContratoAnterior[]
    );

    await adminClient
      .from('sinalizacoes')
      .delete()
      .eq('documento_id', doc.id)
      .eq('natureza', 'contexto_negocio')
      .eq('resolucao', 'pendente');

    if (candidatos.length > 0) {
      const { error: erroInsert } = await adminClient.from('sinalizacoes').insert(
        candidatos.map((c) => ({
          documento_id: doc.id,
          clausula_numero: c.clausula_numero,
          trecho_original: c.trecho_original,
          offset_inicio: c.offset_inicio,
          offset_fim: c.offset_fim,
          categoria: c.categoria,
          natureza: c.natureza,
          sugestao_ajuste: c.sugestao_ajuste,
          justificativa: c.justificativa,
          severidade: c.severidade,
          fonte_inferencia: c.fonte_inferencia,
        }))
      );
      if (erroInsert) throw erroInsert;
    }

    await adminClient.from('notificacoes').insert({
      usuario_id: doc.autor_id,
      documento_id: doc.id,
      tipo: 'analise_contexto_concluida',
      titulo: 'Análise de contexto do cliente concluída',
      corpo: `${candidatos.length} ponto(s) de contexto encontrado(s) em "${doc.titulo}".`,
    });

    await adminClient.rpc('concluir_job_contexto_cliente', {
      p_job_id: job.id,
      p_resultado_resumo: { sinalizacoes_geradas: candidatos.length },
    });

    return { job, sinalizacoesGeradas: candidatos.length };
  } catch (erro) {
    await adminClient.rpc('falhar_job_contexto_cliente', {
      p_job_id: job.id,
      p_erro: erro instanceof Error ? erro.message : String(erro),
    });
    throw erro;
  }
}
