import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import { resolverSinalizacao } from '@/lib/services/sinalizacoes';
import type { FonteInferenciaContexto } from '@/types/database.types';

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

    if (body.resolucao === 'aplicada') {
      const { data: existente } = await supabase.from('sinalizacoes').select('fonte_inferencia').eq('id', id).maybeSingle();
      const fonte = (existente as { fonte_inferencia: FonteInferenciaContexto | null } | null)?.fonte_inferencia;
      // Apontamento informativo (ficha ou campo em branco) só pede uma providência do autor:
      // não há texto a aplicar, então "aplicar" colaria a mensagem dentro do contrato.
      if (fonte?.acao === 'informativo') {
        return NextResponse.json({ erro: 'Este apontamento é informativo: faça a providência indicada na minuta e use "Resolvido".' }, { status: 422 });
      }
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
