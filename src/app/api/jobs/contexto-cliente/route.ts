import { NextResponse } from 'next/server';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { processarProximoJobContextoCliente } from '@/lib/services/contexto-cliente-worker';

const MAXIMO_JOBS_POR_CHAMADA = 20;

function autorizado(request: Request): boolean {
  const segredo = process.env.JOBS_WORKER_SECRET;
  if (!segredo) return false;
  return request.headers.get('authorization') === `Bearer ${segredo}`;
}

/**
 * Worker da fila de análise de contexto do cliente (categoria 5, assíncrona).
 * Chamado por um agendador externo (Vercel Cron, cron do Supabase, etc.) — não
 * é uma rota de usuário; autentica por segredo compartilhado, não por sessão.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
  }

  const admin = criarClienteAdmin();
  const processados: { documentoId: string; sinalizacoesGeradas: number }[] = [];

  for (let i = 0; i < MAXIMO_JOBS_POR_CHAMADA; i++) {
    const resultado = await processarProximoJobContextoCliente(admin).catch((erro) => {
      console.error('Falha ao processar job de contexto do cliente:', erro);
      return undefined;
    });
    if (!resultado) break;
    processados.push({ documentoId: resultado.job.documento_id, sinalizacoesGeradas: resultado.sinalizacoesGeradas });
  }

  return NextResponse.json({ totalProcessados: processados.length, processados });
}
