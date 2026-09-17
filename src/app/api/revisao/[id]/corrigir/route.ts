import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import { corrigirDiretamente } from '@/lib/services/revisao';
import type { CategoriaSinalizacao } from '@/types/database.types';

/** Corrigir diretamente: edição inline do sócio; gera um registro de Correção vinculado ao autor da minuta. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const body = (await request.json()) as {
      offsetInicio: number;
      offsetFim: number;
      textoAntes: string;
      textoDepois: string;
      clausulaNumero?: string;
      categoria?: CategoriaSinalizacao;
      sinalizacaoOrigemId?: string;
    };

    const correcao = await corrigirDiretamente(supabase, { documentoId: id, ...body });
    return NextResponse.json({ correcao });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
