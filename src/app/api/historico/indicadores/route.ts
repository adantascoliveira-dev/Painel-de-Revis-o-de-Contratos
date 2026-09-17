import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import { buscarIndicadoresGerais } from '@/lib/services/historico';

/** Indicadores gerais do topo da Tela 4: minutas revisadas, correções do sócio, desvio mais comum, tempo médio. */
export async function GET() {
  try {
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);
    return NextResponse.json({ indicadores: await buscarIndicadoresGerais(supabase) });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
