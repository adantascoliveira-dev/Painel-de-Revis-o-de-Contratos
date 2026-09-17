import { NextResponse } from 'next/server';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { processarProximoJobContextoCliente } from '@/lib/services/contexto-cliente-worker';

const MAXIMO_JOBS_POR_CHAMADA = 20;

// CRON_SECRET é o nome que a própria Vercel usa por convenção: se uma env var
// com esse nome existir no projeto, toda chamada disparada pelo Cron da Vercel
// já chega com "Authorization: Bearer <CRON_SECRET>" preenchido automaticamente
// (https://vercel.com/docs/cron-jobs/manage-cron-jobs) — não precisa configurar
// nada além da env var. O mesmo segredo serve pra disparo manual/externo
// (ex.: GitHub Actions), bastando mandar o header na mão.
function autorizado(request: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  return request.headers.get('authorization') === `Bearer ${segredo}`;
}

/**
 * Worker da fila de análise de contexto do cliente (categoria 5, assíncrona).
 * Chamado por um agendador externo (Vercel Cron, GitHub Actions, etc.) — não
 * é uma rota de usuário; autentica por segredo compartilhado, não por sessão.
 * GET (o método que o Cron nativo da Vercel dispara) e POST (disparo manual/
 * externo) fazem exatamente a mesma coisa.
 */
async function processarFila(request: Request) {
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

export async function GET(request: Request) {
  return processarFila(request);
}

export async function POST(request: Request) {
  return processarFila(request);
}
