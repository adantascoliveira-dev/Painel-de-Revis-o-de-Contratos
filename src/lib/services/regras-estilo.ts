import type { SupabaseClient } from '@supabase/supabase-js';
import type { RegraEstilo } from '@/types/database.types';

/** Regras ativas do guia de estilo vigente (só existe um guia com ativo=true). */
export async function buscarRegrasEstiloVigentes(supabase: SupabaseClient): Promise<RegraEstilo[]> {
  const { data: guia, error: erroGuia } = await supabase
    .from('guias_estilo')
    .select('id')
    .eq('ativo', true)
    .maybeSingle();
  if (erroGuia) throw erroGuia;
  if (!guia) return [];

  const { data: regras, error: erroRegras } = await supabase
    .from('regras_estilo')
    .select('*')
    .eq('guia_estilo_id', guia.id)
    .eq('ativo', true);
  if (erroRegras) throw erroRegras;

  return (regras ?? []) as RegraEstilo[];
}
