import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import { buscarDocumento } from '@/lib/services/documentos';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const documento = await buscarDocumento(supabase, id);
    if (!documento) return NextResponse.json({ erro: 'Documento não encontrado.' }, { status: 404 });
    return NextResponse.json({ documento });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
