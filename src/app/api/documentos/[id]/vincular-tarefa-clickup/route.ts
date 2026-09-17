import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import type { Documento } from '@/types/database.types';

/** Vincula (ou desvincula, com clickupTaskId: null) a minuta à sua task no ClickUp. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const { clickupTaskId } = (await request.json()) as { clickupTaskId: string | null };
    const { data, error } = await supabase.rpc('vincular_tarefa_clickup', {
      p_documento_id: id,
      p_clickup_task_id: clickupTaskId,
    });
    if (error) throw error;
    return NextResponse.json({ documento: data as Documento });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
