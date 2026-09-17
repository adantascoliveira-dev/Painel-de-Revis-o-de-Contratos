import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { alinharClausulas } from '@/lib/extracao/alinhamento';
import { criarClienteServidor } from '@/lib/supabase/server';
import { buscarDocumento } from '@/lib/services/documentos';
import { calcularContadoresChecagem, listarSinalizacoes } from '@/lib/services/sinalizacoes';
import type { ModeloAprovado } from '@/types/database.types';

/**
 * Tela 2 — Comparação e checagem: modelo x minuta lado a lado (alinhado por
 * cláusula quando a numeração permitir), sinalizações separadas por natureza
 * (estilo x contexto de negócio) e os contadores ao vivo.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const documento = await buscarDocumento(supabase, id);
    if (!documento) return NextResponse.json({ erro: 'Documento não encontrado.' }, { status: 404 });

    let modeloAprovado: ModeloAprovado | null = null;
    if (documento.modelo_aprovado_id) {
      const { data } = await supabase.from('modelos_aprovados').select('*').eq('id', documento.modelo_aprovado_id).maybeSingle();
      modeloAprovado = data as ModeloAprovado | null;
    }

    const sinalizacoes = await listarSinalizacoes(supabase, id);
    const alinhamento = alinharClausulas(modeloAprovado?.clausulas ?? [], documento.clausulas);

    return NextResponse.json({
      documento,
      modeloAprovado,
      modeloEncontrado: modeloAprovado !== null,
      alinhamento,
      sinalizacoesEstilo: sinalizacoes.filter((s) => s.natureza === 'estilo'),
      sinalizacoesContexto: sinalizacoes.filter((s) => s.natureza === 'contexto_negocio'),
      contadores: calcularContadoresChecagem(sinalizacoes),
    });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
