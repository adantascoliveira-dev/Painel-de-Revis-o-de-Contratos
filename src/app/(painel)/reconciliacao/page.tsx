import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { listarFontesReconciliacaoPendentes } from '@/lib/services/reconciliacao';
import { criarClienteServidor } from '@/lib/supabase/server';
import type { Cliente } from '@/types/database.types';
import { ReconciliacaoView, type FontePendente } from './ReconciliacaoView';

export default async function ReconciliacaoPage() {
  const supabase = await criarClienteServidor();
  const usuarioAtual = await exigirUsuarioAtual(supabase);

  const [pendentes, { data: clientes }] = await Promise.all([
    listarFontesReconciliacaoPendentes(supabase).catch(() => []),
    supabase.from('clientes').select('id, nome').eq('ativo', true).order('nome'),
  ]);

  return (
    <ReconciliacaoView
      usuarioAtual={usuarioAtual}
      pendentesIniciais={pendentes as unknown as FontePendente[]}
      clientes={(clientes ?? []) as Pick<Cliente, 'id' | 'nome'>[]}
    />
  );
}
