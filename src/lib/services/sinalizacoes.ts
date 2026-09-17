import type { SupabaseClient } from '@supabase/supabase-js';
import type { Sinalizacao } from '@/types/database.types';

export async function listarSinalizacoes(supabase: SupabaseClient, documentoId: string): Promise<Sinalizacao[]> {
  const { data, error } = await supabase
    .from('sinalizacoes')
    .select('*')
    .eq('documento_id', documentoId)
    .order('offset_inicio', { ascending: true });
  if (error) throw error;
  return data as Sinalizacao[];
}

/** Aplicar ajuste, manter redação, ou editar a sugestão antes de aplicar. */
export async function resolverSinalizacao(
  supabase: SupabaseClient,
  input: { sinalizacaoId: string; resolucao: 'aplicada' | 'mantida'; textoEditado?: string }
): Promise<Sinalizacao> {
  const { data, error } = await supabase.rpc('resolver_sinalizacao', {
    p_sinalizacao_id: input.sinalizacaoId,
    p_resolucao: input.resolucao,
    p_texto_editado: input.textoEditado ?? null,
  });
  if (error) throw error;
  return data as Sinalizacao;
}

/** Ação em lote: aplica todos os desvios de estilo (categorias 1-4) pendentes. */
export async function aplicarSinalizacoesEmLote(supabase: SupabaseClient, documentoId: string): Promise<number> {
  const { data, error } = await supabase.rpc('aplicar_sinalizacoes_em_lote', { p_documento_id: documentoId });
  if (error) throw error;
  return Number(data);
}

export interface ContadoresChecagem {
  desviosEmAberto: number;
  pontosDeContexto: number;
  ajustesAplicados: number;
  percentualAderencia: number;
}

/** Contadores ao vivo exibidos na Tela 2. */
export function calcularContadoresChecagem(sinalizacoes: Sinalizacao[]): ContadoresChecagem {
  const estilo = sinalizacoes.filter((s) => s.natureza === 'estilo');
  const contexto = sinalizacoes.filter((s) => s.natureza === 'contexto_negocio');
  const desviosEmAberto = estilo.filter((s) => s.resolucao === 'pendente').length;
  const ajustesAplicados = sinalizacoes.filter((s) => s.resolucao === 'aplicada').length;
  const totalEstilo = estilo.length;
  const percentualAderencia = totalEstilo === 0 ? 100 : Math.round(((totalEstilo - desviosEmAberto) / totalEstilo) * 100);

  return {
    desviosEmAberto,
    pontosDeContexto: contexto.filter((s) => s.resolucao === 'pendente').length,
    ajustesAplicados,
    percentualAderencia,
  };
}
