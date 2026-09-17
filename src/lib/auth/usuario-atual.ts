import type { SupabaseClient } from '@supabase/supabase-js';
import type { Usuario } from '@/types/database.types';

export class NaoAutenticadoError extends Error {
  constructor() {
    super('Não autenticado.');
  }
}

/** Usuário autenticado da sessão atual (perfil incluído) — 401 se não houver sessão. */
export async function exigirUsuarioAtual(supabase: SupabaseClient): Promise<Usuario> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new NaoAutenticadoError();

  const { data, error } = await supabase.from('usuarios').select('*').eq('id', user.id).single();
  if (error) throw error;
  return data as Usuario;
}
