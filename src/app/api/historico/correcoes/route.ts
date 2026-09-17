import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import { exportarHistoricoParaCsv, listarHistoricoCorrecoes } from '@/lib/services/historico';
import type { CategoriaSinalizacao } from '@/types/database.types';

/** Tabela de correções da Tela 4, com filtros e exportação (?formato=csv). */
export async function GET(request: Request) {
  try {
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const { searchParams } = new URL(request.url);
    const correcoes = await listarHistoricoCorrecoes(supabase, {
      periodoInicio: searchParams.get('periodoInicio') ?? undefined,
      periodoFim: searchParams.get('periodoFim') ?? undefined,
      autorId: searchParams.get('autorId') ?? undefined,
      categoria: (searchParams.get('categoria') as CategoriaSinalizacao) ?? undefined,
      clienteId: searchParams.get('clienteId') ?? undefined,
      tipoPecaId: searchParams.get('tipoPecaId') ?? undefined,
    });

    if (searchParams.get('formato') === 'csv') {
      return new NextResponse(exportarHistoricoParaCsv(correcoes), {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="correcoes.csv"' },
      });
    }

    return NextResponse.json({ correcoes });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
