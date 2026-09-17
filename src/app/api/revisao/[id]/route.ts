import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import { montarRevisaoFinal } from '@/lib/services/revisao';

/**
 * Tela 3 — Revisão final: pontos já tratados x pendentes, com os que exigem
 * julgamento humano destacados à parte e com o contexto que fundamenta a decisão.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const dados = await montarRevisaoFinal(supabase, id);
    return NextResponse.json(dados);
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
