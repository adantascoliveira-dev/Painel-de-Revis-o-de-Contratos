import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { listarTarefasEmAndamento } from '@/lib/integrations/clickup';
import { criarClienteServidor } from '@/lib/supabase/server';
import type { Cliente } from '@/types/database.types';

/** Demandas em andamento do cliente no ClickUp, para escolher qual vincular à minuta. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const { data: cliente, error } = await supabase.from('clientes').select('*').eq('id', id).single();
    if (error) throw error;
    const clickupClientId = (cliente as Cliente).clickup_client_id;
    if (!clickupClientId) {
      return NextResponse.json({ erro: 'Este cliente ainda não está vinculado a uma lista do ClickUp.' }, { status: 422 });
    }

    const tarefas = await listarTarefasEmAndamento(clickupClientId);
    return NextResponse.json({ tarefas });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
