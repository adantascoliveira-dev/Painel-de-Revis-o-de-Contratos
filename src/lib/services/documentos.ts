import type { SupabaseClient } from '@supabase/supabase-js';
import { extrairClausulas } from '@/lib/extracao/clausulas';
import type { CategoriaSinalizacao, Documento } from '@/types/database.types';

export interface CriarDocumentoInput {
  titulo: string;
  texto: string;
  tipoPecaId: string;
  clienteId: string;
  autorId: string;
  socioRevisorId: string;
  categoriasHabilitadas: CategoriaSinalizacao[];
  arquivoOriginal?: {
    path: string;
    nome: string;
    mime: string;
    tamanhoBytes: number;
  };
}

export interface CriarDocumentoResultado {
  documento: Documento;
  modeloEncontrado: boolean;
}

/**
 * Orquestra a Tela 1: seleciona o modelo aprovado mais próximo (prioriza o
 * mesmo cliente, depois clientes do mesmo tipo, depois o modelo genérico do
 * tipo de peça) e cria o documento em rascunho. Quando não há nenhum modelo
 * para o tipo de peça, cria mesmo assim (a Tela 2 segue só com as regras do
 * guia) e avisa o chamador via `modeloEncontrado: false`.
 */
export async function criarDocumento(
  supabase: SupabaseClient,
  input: CriarDocumentoInput
): Promise<CriarDocumentoResultado> {
  const { data: modeloId, error: erroSelecao } = await supabase.rpc('selecionar_melhor_modelo', {
    p_tipo_peca_id: input.tipoPecaId,
    p_cliente_id: input.clienteId,
  });
  if (erroSelecao) throw erroSelecao;

  const clausulas = extrairClausulas(input.texto);

  const { data: documento, error } = await supabase
    .from('documentos')
    .insert({
      titulo: input.titulo,
      texto_extraido: input.texto,
      texto_trabalho: input.texto,
      clausulas,
      tipo_peca_id: input.tipoPecaId,
      cliente_id: input.clienteId,
      autor_id: input.autorId,
      socio_revisor_id: input.socioRevisorId,
      modelo_aprovado_id: modeloId ?? null,
      categorias_checagem_habilitadas: input.categoriasHabilitadas,
      status: 'rascunho',
      arquivo_original_path: input.arquivoOriginal?.path ?? null,
      arquivo_original_nome: input.arquivoOriginal?.nome ?? null,
      arquivo_original_mime: input.arquivoOriginal?.mime ?? null,
      arquivo_original_tamanho_bytes: input.arquivoOriginal?.tamanhoBytes ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;

  return { documento: documento as Documento, modeloEncontrado: modeloId !== null };
}

export async function buscarDocumento(supabase: SupabaseClient, documentoId: string): Promise<Documento | null> {
  const { data, error } = await supabase.from('documentos').select('*').eq('id', documentoId).maybeSingle();
  if (error) throw error;
  return data as Documento | null;
}

export async function listarDocumentos(supabase: SupabaseClient, filtros?: { status?: string; clienteId?: string }) {
  let query = supabase.from('documentos').select('*').order('criado_em', { ascending: false });
  if (filtros?.status) query = query.eq('status', filtros.status);
  if (filtros?.clienteId) query = query.eq('cliente_id', filtros.clienteId);
  const { data, error } = await query;
  if (error) throw error;
  return data as Documento[];
}
