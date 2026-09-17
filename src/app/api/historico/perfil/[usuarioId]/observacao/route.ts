import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import { salvarObservacaoQualitativa } from '@/lib/services/historico';

/** Campo de observação qualitativa editável pelo sócio (Tela 4). */
export async function PUT(request: Request, { params }: { params: Promise<{ usuarioId: string }> }) {
  try {
    const { usuarioId } = await params;
    const supabase = await criarClienteServidor();
    const autor = await exigirUsuarioAtual(supabase);

    const { texto } = (await request.json()) as { texto: string };
    await salvarObservacaoQualitativa(supabase, { usuarioId, autorId: autor.id, texto });
    return NextResponse.json({ ok: true });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
