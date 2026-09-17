import type { SupabaseClient } from '@supabase/supabase-js';
import { buscarRegrasEstiloVigentes } from '@/lib/services/regras-estilo';
import { derivarPontosDeJulgamentoHumano, type PontoJulgamentoHumano } from '@/lib/services/pontos-julgamento-humano';
import type { CategoriaSinalizacao, Correcao, Documento, ModeloAprovado } from '@/types/database.types';

export async function aprovarDocumento(supabase: SupabaseClient, documentoId: string): Promise<Documento> {
  const { data, error } = await supabase.rpc('aprovar_documento', { p_documento_id: documentoId });
  if (error) throw error;
  return data as Documento;
}

export async function pedirAjusteEquipe(
  supabase: SupabaseClient,
  input: { documentoId: string; observacao: string; prazo: string }
): Promise<Documento> {
  const { data, error } = await supabase.rpc('pedir_ajuste_equipe', {
    p_documento_id: input.documentoId,
    p_observacao: input.observacao,
    p_prazo: input.prazo,
  });
  if (error) throw error;
  return data as Documento;
}

export async function corrigirDiretamente(
  supabase: SupabaseClient,
  input: {
    documentoId: string;
    offsetInicio: number;
    offsetFim: number;
    textoAntes: string;
    textoDepois: string;
    clausulaNumero?: string;
    categoria?: CategoriaSinalizacao;
    sinalizacaoOrigemId?: string;
  }
): Promise<Correcao> {
  const { data, error } = await supabase.rpc('corrigir_diretamente', {
    p_documento_id: input.documentoId,
    p_offset_inicio: input.offsetInicio,
    p_offset_fim: input.offsetFim,
    p_texto_antes: input.textoAntes,
    p_texto_depois: input.textoDepois,
    p_clausula_numero: input.clausulaNumero ?? null,
    p_categoria: input.categoria ?? null,
    p_sinalizacao_origem_id: input.sinalizacaoOrigemId ?? null,
  });
  if (error) throw error;
  return data as Correcao;
}

export async function promoverDocumentoAModelo(
  supabase: SupabaseClient,
  input: { documentoId: string; codigo: string; generico?: boolean }
): Promise<ModeloAprovado> {
  const { data: documento, error: erroDoc } = await supabase
    .from('documentos')
    .select('texto_trabalho')
    .eq('id', input.documentoId)
    .single();
  if (erroDoc) throw erroDoc;

  const { extrairClausulas } = await import('@/lib/extracao/clausulas');
  const clausulas = extrairClausulas((documento as { texto_trabalho: string }).texto_trabalho);

  const { data, error } = await supabase.rpc('promover_documento_a_modelo', {
    p_documento_id: input.documentoId,
    p_codigo: input.codigo,
    p_clausulas: clausulas,
    p_generico: input.generico ?? false,
  });
  if (error) throw error;
  return data as ModeloAprovado;
}

/**
 * Monta os dados da Tela 3 (Revisão final): documento, sinalizações já
 * resolvidas x pendentes, e os pontos que exigem julgamento humano com o
 * contexto que fundamenta a decisão do sócio.
 */
export async function montarRevisaoFinal(supabase: SupabaseClient, documentoId: string) {
  const { data: documento, error: erroDoc } = await supabase
    .from('documentos')
    .select('*')
    .eq('id', documentoId)
    .single();
  if (erroDoc) throw erroDoc;
  const doc = documento as Documento;

  const { data: sinalizacoes, error: erroSinalizacoes } = await supabase
    .from('sinalizacoes')
    .select('*')
    .eq('documento_id', documentoId)
    .order('offset_inicio', { ascending: true });
  if (erroSinalizacoes) throw erroSinalizacoes;

  const pendentes = (sinalizacoes ?? []).filter((s) => s.resolucao === 'pendente');
  const resolvidas = (sinalizacoes ?? []).filter((s) => s.resolucao !== 'pendente');

  let modeloAprovado: ModeloAprovado | null = null;
  if (doc.modelo_aprovado_id) {
    const { data } = await supabase.from('modelos_aprovados').select('*').eq('id', doc.modelo_aprovado_id).maybeSingle();
    modeloAprovado = data as ModeloAprovado | null;
  }

  const { data: contratosAnteriores } = await supabase
    .from('cliente_contratos_anteriores')
    .select('resumo_clausulas')
    .eq('cliente_id', doc.cliente_id)
    .eq('tipo_peca_id', doc.tipo_peca_id);

  const regrasEstiloAtivas = await buscarRegrasEstiloVigentes(supabase);

  const pontosDeJulgamentoHumano: PontoJulgamentoHumano[] = derivarPontosDeJulgamentoHumano({
    documento: doc,
    sinalizacoesPendentes: pendentes,
    modeloAprovado,
    contratosAnteriores: (contratosAnteriores ?? []) as { resumo_clausulas: Record<string, unknown> }[],
    regrasEstiloAtivas,
  });

  return { documento: doc, sinalizacoesPendentes: pendentes, sinalizacoesResolvidas: resolvidas, pontosDeJulgamentoHumano };
}
