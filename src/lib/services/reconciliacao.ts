import type { SupabaseClient } from '@supabase/supabase-js';
import type { PastaClienteDrive } from '@/lib/integrations/google-drive';
import type { ListaClickUp } from '@/lib/integrations/clickup';
import type { FonteReconciliacaoRow } from '@/types/database.types';

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
export async function sincronizarFontesReconciliacao(
  adminClient: SupabaseClient,
  fontes: { googleDrive?: PastaClienteDrive[]; clickUp?: ListaClickUp[] }
): Promise<{ inseridas: number; atualizadas: number }> {
  let inseridas = 0;
  let atualizadas = 0;

  for (const pasta of fontes.googleDrive ?? []) {
    const sugestao = await sugerirCliente(adminClient, pasta.nome);
    const { data: existente } = await adminClient
      .from('fontes_reconciliacao')
      .select('id, status')
      .eq('fonte', 'google_drive')
      .eq('referencia_externa_id', pasta.pastaId)
      .maybeSingle();

    const payload = {
      cliente_candidato_nome: pasta.nome,
      fonte: 'google_drive' as const,
      referencia_externa_id: pasta.pastaId,
      dados_brutos: { arquivos: pasta.arquivos.map((a) => ({ id: a.id, nome: a.name, modificadoEm: a.modifiedTime })) },
      cliente_id_sugerido: sugestao?.cliente_id ?? null,
      similaridade: sugestao?.similaridade ?? null,
    };

    if (existente && (existente as FonteReconciliacaoRow).status === 'pendente') {
      await adminClient.from('fontes_reconciliacao').update(payload).eq('id', existente.id);
      atualizadas++;
    } else if (!existente) {
      await adminClient.from('fontes_reconciliacao').insert(payload);
      inseridas++;
    }
    // Já confirmado/descartado/mesclado: não sobrescreve a decisão do sócio.
  }

  for (const lista of fontes.clickUp ?? []) {
    const sugestao = await sugerirCliente(adminClient, lista.listaNome);
    const { data: existente } = await adminClient
      .from('fontes_reconciliacao')
      .select('id, status')
      .eq('fonte', 'clickup')
      .eq('referencia_externa_id', lista.listaId)
      .maybeSingle();

    const payload = {
      cliente_candidato_nome: lista.listaNome,
      fonte: 'clickup' as const,
      referencia_externa_id: lista.listaId,
      dados_brutos: { espaco: lista.espacoNome, pasta: lista.pastaNome },
      cliente_id_sugerido: sugestao?.cliente_id ?? null,
      similaridade: sugestao?.similaridade ?? null,
    };

    if (existente && (existente as FonteReconciliacaoRow).status === 'pendente') {
      await adminClient.from('fontes_reconciliacao').update(payload).eq('id', existente.id);
      atualizadas++;
    } else if (!existente) {
      await adminClient.from('fontes_reconciliacao').insert(payload);
      inseridas++;
    }
  }

  return { inseridas, atualizadas };
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
