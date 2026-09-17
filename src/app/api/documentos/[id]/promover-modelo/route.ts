import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import { promoverDocumentoAModelo } from '@/lib/services/revisao';

/**
 * Promove um documento já aprovado a modelo aprovado, mesmo depois do momento
 * da aprovação (a opção também existe embutida em /api/revisao/[id]/aprovar).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const body = (await request.json()) as { codigo: string; generico?: boolean };
    if (!body.codigo) return NextResponse.json({ erro: 'codigo é obrigatório.' }, { status: 400 });

    const modeloAprovado = await promoverDocumentoAModelo(supabase, { documentoId: id, codigo: body.codigo, generico: body.generico });
    return NextResponse.json({ modeloAprovado });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
