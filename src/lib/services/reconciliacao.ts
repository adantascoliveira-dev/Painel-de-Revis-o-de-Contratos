import type { SupabaseClient } from '@supabase/supabase-js';
import type { PastaClienteDrive } from '@/lib/integrations/google-drive';
import type { ListaClickUp } from '@/lib/integrations/clickup';
import type { FonteReconciliacaoRow } from '@/types/database.types';
import { mapComLimite } from '@/lib/utils/concorrencia';

async function sugerirCliente(adminClient: SupabaseClient, nome: string) {
  const { data, error } = await adminClient.rpc('sugerir_cliente_por_nome', { p_nome: nome });
  if (error) throw error;
  const sugestao = (data as { cliente_id: string; similaridade: number }[] | null)?.[0];
  return sugestao ?? null;
}

/**
 * Lê as duas fontes e alimenta fontes_reconciliacao com o candidato + a melhor
 * sugestão de match — nunca grava direto em "clientes". A lista hoje é
 * inconsistente entre Drive e ClickUp (spec do produto), por isso a tela de
 * reconciliação existe: o sócio decide o cadastro canônico, não o sistema.
 */
type PayloadFonte = Pick<
  FonteReconciliacaoRow,
  'cliente_candidato_nome' | 'fonte' | 'referencia_externa_id' | 'dados_brutos' | 'cliente_id_sugerido' | 'similaridade'
>;

/** Resolve a sugestão de cliente e grava (insert/update) um único candidato. Uma fonte por vez, chamado em paralelo pelo mapComLimite abaixo. */
async function gravarCandidato(
  adminClient: SupabaseClient,
  nome: string,
  fonte: PayloadFonte['fonte'],
  referenciaExternaId: string,
  dadosBrutos: PayloadFonte['dados_brutos']
): Promise<'inserida' | 'atualizada' | 'ignorada'> {
  const [sugestao, { data: existente }] = await Promise.all([
    sugerirCliente(adminClient, nome),
    adminClient.from('fontes_reconciliacao').select('id, status').eq('fonte', fonte).eq('referencia_externa_id', referenciaExternaId).maybeSingle(),
  ]);

  const payload: PayloadFonte = {
    cliente_candidato_nome: nome,
    fonte,
    referencia_externa_id: referenciaExternaId,
    dados_brutos: dadosBrutos,
    cliente_id_sugerido: sugestao?.cliente_id ?? null,
    similaridade: sugestao?.similaridade ?? null,
  };

  if (existente && (existente as FonteReconciliacaoRow).status === 'pendente') {
    await adminClient.from('fontes_reconciliacao').update(payload).eq('id', existente.id);
    return 'atualizada';
  } else if (!existente) {
    await adminClient.from('fontes_reconciliacao').insert(payload);
    return 'inserida';
  }
  // Já confirmado/descartado/mesclado: não sobrescreve a decisão do sócio.
  return 'ignorada';
}

export async function sincronizarFontesReconciliacao(
  adminClient: SupabaseClient,
  fontes: { googleDrive?: PastaClienteDrive[]; clickUp?: ListaClickUp[] }
): Promise<{ inseridas: number; atualizadas: number }> {
  // Cada candidato já passou de 100 no Drive de produção — sequencial (um de
  // cada vez) estoura o tempo de resposta. 10 em paralelo é rápido sem
  // esgotar o pool de conexões do Supabase.
  const resultadosDrive = await mapComLimite(fontes.googleDrive ?? [], 10, (pasta) =>
    gravarCandidato(
      adminClient,
      pasta.nome,
      'google_drive',
      pasta.pastaId,
      { arquivos: pasta.arquivos.map((a) => ({ id: a.id, nome: a.name, modificadoEm: a.modifiedTime })) }
    )
  );

  const resultadosClickUp = await mapComLimite(fontes.clickUp ?? [], 10, (lista) =>
    gravarCandidato(adminClient, lista.listaNome, 'clickup', lista.listaId, { espaco: lista.espacoNome, pasta: lista.pastaNome })
  );

  const todos = [...resultadosDrive, ...resultadosClickUp];
  return {
    inseridas: todos.filter((r) => r === 'inserida').length,
    atualizadas: todos.filter((r) => r === 'atualizada').length,
  };
}

export async function listarFontesReconciliacaoPendentes(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('fontes_reconciliacao')
    .select('*, cliente_sugerido:clientes!fontes_reconciliacao_cliente_id_sugerido_fkey(id, nome)')
    .eq('status', 'pendente')
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return data;
}

export async function confirmarReconciliacao(
  supabase: SupabaseClient,
  input: { fonteId: string; clienteId?: string; novoCliente?: Record<string, unknown>; status?: 'confirmado' | 'descartado' | 'mesclado' }
) {
  const { data, error } = await supabase.rpc('confirmar_reconciliacao', {
    p_fonte_id: input.fonteId,
    p_cliente_id: input.clienteId ?? null,
    p_novo_cliente: input.novoCliente ?? null,
    p_status: input.status ?? 'confirmado',
  });
  if (error) throw error;
  return data as FonteReconciliacaoRow;
}
