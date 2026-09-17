import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import { buscarPerfilUsuario } from '@/lib/services/historico';

/** Perfil de um integrante (Tela 4): volume, correções, categorias recorrentes, evolução. */
export async function GET(_request: Request, { params }: { params: Promise<{ usuarioId: string }> }) {
  try {
    const { usuarioId } = await params;
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const perfil = await buscarPerfilUsuario(supabase, usuarioId);
    if (!perfil) return NextResponse.json({ erro: 'Perfil não encontrado ou sem permissão para vê-lo.' }, { status: 404 });
    return NextResponse.json(perfil);
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
