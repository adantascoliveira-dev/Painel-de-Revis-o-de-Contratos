import { notFound } from 'next/navigation';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { montarRevisaoFinal } from '@/lib/services/revisao';
import { criarClienteServidor } from '@/lib/supabase/server';
import type { Cliente, TipoPeca, Usuario } from '@/types/database.types';
import { RevisaoView } from './RevisaoView';

export default async function RevisaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await criarClienteServidor();
  const usuarioAtual = await exigirUsuarioAtual(supabase);

  const dados = await montarRevisaoFinal(supabase, id).catch(() => null);
  if (!dados) notFound();

  const [clienteResp, tipoPecaResp, autorResp] = await Promise.all([
    supabase.from('clientes').select('*').eq('id', dados.documento.cliente_id).single(),
    supabase.from('tipos_peca').select('*').eq('id', dados.documento.tipo_peca_id).single(),
    supabase.from('usuarios').select('*').eq('id', dados.documento.autor_id).single(),
  ]);

  return (
    <RevisaoView
      usuarioAtual={usuarioAtual}
      documento={dados.documento}
      cliente={clienteResp.data as Cliente}
      tipoPeca={tipoPecaResp.data as TipoPeca}
      autor={autorResp.data as Usuario}
      sinalizacoesPendentesIniciais={dados.sinalizacoesPendentes}
      sinalizacoesResolvidas={dados.sinalizacoesResolvidas}
      pontosDeJulgamentoHumano={dados.pontosDeJulgamentoHumano}
    />
  );
}
