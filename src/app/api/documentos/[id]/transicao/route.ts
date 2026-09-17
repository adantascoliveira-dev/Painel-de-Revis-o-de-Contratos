import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { criarClienteServidor } from '@/lib/supabase/server';
import { executarChecagemSincrona } from '@/lib/services/checagem';
import { enfileirarAnaliseContextoCliente } from '@/lib/services/contexto-cliente-worker';
import type { Documento, StatusDocumento } from '@/types/database.types';

/**
 * Transições genéricas da máquina de estados (rascunho -> em_checagem,
 * em_checagem -> aguardando_socio, em_ajuste_pela_equipe -> em_checagem). As
 * transições que exigem dados extra específicos (aprovar, pedir ajuste,
 * corrigir) têm rotas próprias em /api/revisao — esta cobre o restante.
 *
 * Ao entrar em "em_checagem", dispara a checagem síncrona de estilo na hora e
 * enfileira a análise assíncrona de contexto do cliente.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const body = (await request.json()) as { statusNovo: StatusDocumento; observacao?: string; prazo?: string };

    const { data: documento, error } = await supabase.rpc('transicionar_documento_status', {
      p_documento_id: id,
      p_status_novo: body.statusNovo,
      p_observacao: body.observacao ?? null,
      p_prazo: body.prazo ?? null,
    });
    if (error) throw error;

    let checagem: { totalSinalizacoesEstilo: number } | null = null;
    if (body.statusNovo === 'em_checagem') {
      const admin = criarClienteAdmin();
      checagem = await executarChecagemSincrona(admin, documento as Documento);
      await enfileirarAnaliseContextoCliente(supabase, id);
    }

    return NextResponse.json({ documento, checagem });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
