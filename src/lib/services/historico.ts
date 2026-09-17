import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CategoriaSinalizacao,
  Correcao,
  VwIndicadoresGerais,
  VwPerfilUsuario,
  VwPerfilUsuarioCategoria,
  VwPerfilUsuarioEvolucaoMensal,
} from '@/types/database.types';

export interface FiltrosHistoricoCorrecoes {
  periodoInicio?: string;
  periodoFim?: string;
  autorId?: string;
  categoria?: CategoriaSinalizacao;
  clienteId?: string;
  tipoPecaId?: string;
}

/** Tabela de correções da Tela 4, com filtros por período, autor, categoria, cliente e tipo de peça. */
export async function listarHistoricoCorrecoes(supabase: SupabaseClient, filtros: FiltrosHistoricoCorrecoes = {}) {
  let query = supabase
    .from('correcoes')
    .select('*, documentos!inner(cliente_id, tipo_peca_id, titulo)')
    .order('criado_em', { ascending: false });

  if (filtros.periodoInicio) query = query.gte('criado_em', filtros.periodoInicio);
  if (filtros.periodoFim) query = query.lte('criado_em', filtros.periodoFim);
  if (filtros.autorId) query = query.eq('autor_minuta_id', filtros.autorId);
  if (filtros.categoria) query = query.eq('categoria', filtros.categoria);
  if (filtros.clienteId) query = query.eq('documentos.cliente_id', filtros.clienteId);
  if (filtros.tipoPecaId) query = query.eq('documentos.tipo_peca_id', filtros.tipoPecaId);

  const { data, error } = await query;
  if (error) throw error;
  return data as (Correcao & { documentos: { cliente_id: string; tipo_peca_id: string; titulo: string } })[];
}

/** Serializa o histórico filtrado em CSV para exportação. */
export function exportarHistoricoParaCsv(
  correcoes: (Correcao & { documentos: { titulo: string } })[]
): string {
  const cabecalho = ['data', 'minuta', 'autor_minuta_id', 'categoria', 'texto_antes', 'texto_depois'];
  const linhas = correcoes.map((c) =>
    [c.criado_em, c.documentos.titulo, c.autor_minuta_id, c.categoria ?? '', c.texto_antes, c.texto_depois]
      .map((valor) => `"${String(valor).replace(/"/g, '""')}"`)
      .join(',')
  );
  return [cabecalho.join(','), ...linhas].join('\n');
}

export interface PerfilCompleto {
  perfil: VwPerfilUsuario;
  categorias: VwPerfilUsuarioCategoria[];
  evolucaoMensal: VwPerfilUsuarioEvolucaoMensal[];
  observacao: string | null;
}

/** Perfil de um integrante: volume, correções, categorias mais recorrentes e evolução no tempo. */
export async function buscarPerfilUsuario(supabase: SupabaseClient, usuarioId: string): Promise<PerfilCompleto | null> {
  const [{ data: perfil }, { data: categorias }, { data: evolucaoMensal }, { data: observacao }] = await Promise.all([
    supabase.from('vw_perfil_usuario').select('*').eq('usuario_id', usuarioId).maybeSingle(),
    supabase.from('vw_perfil_usuario_categoria').select('*').eq('usuario_id', usuarioId).order('posicao'),
    supabase.from('vw_perfil_usuario_evolucao_mensal').select('*').eq('usuario_id', usuarioId).order('mes'),
    supabase.from('perfil_observacoes').select('texto').eq('usuario_id', usuarioId).maybeSingle(),
  ]);

  if (!perfil) return null;

  return {
    perfil: perfil as VwPerfilUsuario,
    categorias: (categorias ?? []) as VwPerfilUsuarioCategoria[],
    evolucaoMensal: (evolucaoMensal ?? []) as VwPerfilUsuarioEvolucaoMensal[],
    observacao: (observacao as { texto: string } | null)?.texto ?? null,
  };
}

/** Só o sócio escreve; a política de RLS de perfil_observacoes também garante isso no banco. */
export async function salvarObservacaoQualitativa(
  supabase: SupabaseClient,
  input: { usuarioId: string; autorId: string; texto: string }
) {
  const { error } = await supabase
    .from('perfil_observacoes')
    .upsert({ usuario_id: input.usuarioId, autor_id: input.autorId, texto: input.texto }, { onConflict: 'usuario_id' });
  if (error) throw error;
}

export async function buscarIndicadoresGerais(supabase: SupabaseClient): Promise<VwIndicadoresGerais | null> {
  const { data, error } = await supabase.from('vw_indicadores_gerais').select('*').maybeSingle();
  if (error) throw error;
  return data as VwIndicadoresGerais | null;
}
