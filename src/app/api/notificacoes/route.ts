import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import type { Notificacao } from '@/types/database.types';

/** Notificações do usuário autenticado, mais recentes primeiro. */
export async function GET() {
  try {
    const supabase = await criarClienteServidor();
    const usuario = await exigirUsuarioAtual(supabase);

    const { data, error } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('usuario_id', usuario.id)
      .order('criado_em', { ascending: false })
      .limit(30);
    if (error) throw error;
    return NextResponse.json({ notificacoes: data as Notificacao[] });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}

/** Marca todas as notificações não lidas do usuário atual como lidas. */
export async function PATCH() {
  try {
    const supabase = await criarClienteServidor();
    const usuario = await exigirUsuarioAtual(supabase);

    const { error } = await supabase.from('notificacoes').update({ lida: true }).eq('usuario_id', usuario.id).eq('lida', false);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
