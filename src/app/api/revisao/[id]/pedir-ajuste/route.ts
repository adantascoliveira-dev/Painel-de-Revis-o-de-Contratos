import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import { pedirAjusteEquipe } from '@/lib/services/revisao';

/** Pede ajuste à equipe: volta ao autor com observação e prazo, anexando os pontos abertos. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const body = (await request.json()) as { observacao: string; prazo: string };
    if (!body.observacao?.trim() || !body.prazo) {
      return NextResponse.json({ erro: 'observacao e prazo são obrigatórios.' }, { status: 400 });
    }

    const documento = await pedirAjusteEquipe(supabase, { documentoId: id, observacao: body.observacao, prazo: body.prazo });
    return NextResponse.json({ documento });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
