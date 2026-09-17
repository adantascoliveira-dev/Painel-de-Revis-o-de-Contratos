import type { SupabaseClient } from '@supabase/supabase-js';
import { detectarClausulasAusentes, executarMotorDeEstilo } from '@/lib/rules/estilo/motor';
import { buscarRegrasEstiloVigentes } from '@/lib/services/regras-estilo';
import type { CategoriaSinalizacao, Documento, ModeloAprovado } from '@/types/database.types';

const CATEGORIAS_ESTILO_POR_TEXTO: CategoriaSinalizacao[] = [
  'juridiques_excesso',
  'tom_culpa',
  'formalismo_fora_padrao',
  'ruido_informacao_desnecessaria',
];

/**
 * Checagem síncrona (categorias 1-4 e 6, todas de natureza "estilo"). Roda o
 * motor de regras contra o texto de trabalho — e, quando há modelo aprovado e
 * a categoria 6 está habilitada, compara a estrutura de cláusulas contra ele —
 * e persiste as sinalizações via um cliente com privilégio (service role):
 * sinalizações são geradas pelo sistema, não escritas pelo usuário, então não
 * têm política de INSERT para o papel autenticado.
 *
 * Reprocessa do zero: remove sinalizações de estilo ainda PENDENTES (mantém o
 * histórico de aplicada/mantida) e insere as recém-detectadas. Chame de novo
 * depois de qualquer edição relevante do texto de trabalho.
 */
export async function executarChecagemSincrona(
  adminClient: SupabaseClient,
  documento: Documento
): Promise<{ totalSinalizacoesEstilo: number }> {
  const categoriasHabilitadas = new Set(documento.categorias_checagem_habilitadas);
  const categoriasPorTextoHabilitadas = CATEGORIAS_ESTILO_POR_TEXTO.filter((c) => categoriasHabilitadas.has(c));

  const todasAsRegras = await buscarRegrasEstiloVigentes(adminClient);

  const regrasPorTexto = todasAsRegras.filter((r) => categoriasPorTextoHabilitadas.includes(r.categoria));
  let candidatos = executarMotorDeEstilo(documento.texto_trabalho, regrasPorTexto);

  if (categoriasHabilitadas.has('clausulas_ausentes') && documento.modelo_aprovado_id) {
    const { data: modelo } = await adminClient
      .from('modelos_aprovados')
      .select('*')
      .eq('id', documento.modelo_aprovado_id)
      .maybeSingle();
    const regraClausulasAusentes = todasAsRegras.find((r) => r.categoria === 'clausulas_ausentes');
    if (modelo && regraClausulasAusentes) {
      candidatos = candidatos.concat(
        detectarClausulasAusentes((modelo as ModeloAprovado).clausulas, documento.clausulas, regraClausulasAusentes)
      );
    }
  }

  const { error: erroDelete } = await adminClient
    .from('sinalizacoes')
    .delete()
    .eq('documento_id', documento.id)
    .eq('natureza', 'estilo')
    .eq('resolucao', 'pendente');
  if (erroDelete) throw erroDelete;

  if (candidatos.length === 0) {
    return { totalSinalizacoesEstilo: 0 };
  }

  const { error: erroInsert } = await adminClient.from('sinalizacoes').insert(
    candidatos.map((c) => ({
      documento_id: documento.id,
      clausula_numero: null,
      trecho_original: c.trecho_original,
      offset_inicio: c.offset_inicio,
      offset_fim: c.offset_fim,
      categoria: c.categoria,
      natureza: c.natureza,
      sugestao_ajuste: c.sugestao_ajuste,
      justificativa: c.justificativa,
      severidade: c.severidade,
      regra_estilo_id: c.regra_estilo_id,
    }))
  );
  if (erroInsert) throw erroInsert;

  return { totalSinalizacoesEstilo: candidatos.length };
}
