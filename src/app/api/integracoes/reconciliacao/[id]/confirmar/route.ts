import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import { confirmarReconciliacao } from '@/lib/services/reconciliacao';

/** O sócio confirma o cadastro canônico: vincula a um cliente existente, cria um novo, ou descarta. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const body = (await request.json()) as {
      clienteId?: string;
      novoCliente?: Record<string, unknown>;
      status?: 'confirmado' | 'descartado' | 'mesclado';
    };

    const fonte = await confirmarReconciliacao(supabase, { fonteId: id, ...body });
    return NextResponse.json({ fonte });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
