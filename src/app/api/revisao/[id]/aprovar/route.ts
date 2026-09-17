import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import { aprovarDocumento, promoverDocumentoAModelo } from '@/lib/services/revisao';

/** Aprovar: congela a versão, gera a trilha, com opção de promover a modelo aprovado. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const body = (await request.json().catch(() => ({}))) as {
      promoverAModelo?: boolean;
      codigoModelo?: string;
      modeloGenerico?: boolean;
    };

    const documento = await aprovarDocumento(supabase, id);

    let modeloAprovado = null;
    if (body.promoverAModelo) {
      if (!body.codigoModelo) {
        return NextResponse.json({ erro: 'codigoModelo é obrigatório para promover a modelo.' }, { status: 400 });
      }
      modeloAprovado = await promoverDocumentoAModelo(supabase, {
        documentoId: id,
        codigo: body.codigoModelo,
        generico: body.modeloGenerico,
      });
    }

    return NextResponse.json({ documento, modeloAprovado });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
