import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import { resolverSinalizacao } from '@/lib/services/sinalizacoes';

/** Aplicar ajuste, manter redação, ou editar a sugestão antes de aplicar (Tela 2). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const body = (await request.json()) as { resolucao: 'aplicada' | 'mantida'; textoEditado?: string };
    if (body.resolucao !== 'aplicada' && body.resolucao !== 'mantida') {
      return NextResponse.json({ erro: 'resolucao deve ser "aplicada" ou "mantida".' }, { status: 400 });
    }

    const sinalizacao = await resolverSinalizacao(supabase, {
      sinalizacaoId: id,
      resolucao: body.resolucao,
      textoEditado: body.textoEditado,
    });
    return NextResponse.json({ sinalizacao });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
