import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import { aplicarSinalizacoesEmLote } from '@/lib/services/sinalizacoes';

/** "Ação em lote para aplicar todos os desvios de estilo" (Tela 2). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const total = await aplicarSinalizacoesEmLote(supabase, id);
    return NextResponse.json({ totalAplicadas: total });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
