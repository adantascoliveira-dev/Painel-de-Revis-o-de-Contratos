import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import type { PerfilUsuario, Usuario } from '@/types/database.types';

/**
 * Lista usuários (para os seletores de autor/sócio revisor da Tela 1). O que
 * cada papel efetivamente enxerga é decidido pela RLS de "usuarios" — esta
 * rota só repassa o filtro de ?perfil=advogado,estagiario.
 */
export async function GET(request: Request) {
  try {
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const { searchParams } = new URL(request.url);
    const perfis = searchParams.get('perfil')?.split(',').filter(Boolean) as PerfilUsuario[] | undefined;

    let query = supabase.from('usuarios').select('*').eq('ativo', true).order('nome');
    if (perfis?.length) query = query.in('perfil', perfis);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ usuarios: data as Usuario[] });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
