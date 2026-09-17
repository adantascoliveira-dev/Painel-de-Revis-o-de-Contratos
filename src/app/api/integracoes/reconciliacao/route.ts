import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import { listarFontesReconciliacaoPendentes } from '@/lib/services/reconciliacao';

/** Tela de reconciliação: candidatos pendentes do Drive/ClickUp com a sugestão de match. */
export async function GET() {
  try {
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);
    return NextResponse.json({ pendentes: await listarFontesReconciliacaoPendentes(supabase) });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
