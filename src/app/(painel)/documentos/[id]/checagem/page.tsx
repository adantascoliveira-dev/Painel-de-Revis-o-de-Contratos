import { notFound } from 'next/navigation';
import { alinharClausulas } from '@/lib/extracao/alinhamento';
import { buscarDocumento } from '@/lib/services/documentos';
import { listarSinalizacoes } from '@/lib/services/sinalizacoes';
import { criarClienteServidor } from '@/lib/supabase/server';
import type { Cliente, ModeloAprovado, TipoPeca, Usuario } from '@/types/database.types';
import { ChecagemView } from './ChecagemView';

export default async function ChecagemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await criarClienteServidor();

  const documento = await buscarDocumento(supabase, id);
  if (!documento) notFound();

  const [modeloResp, sinalizacoes, clienteResp, tipoPecaResp, autorResp] = await Promise.all([
    documento.modelo_aprovado_id
      ? supabase.from('modelos_aprovados').select('*').eq('id', documento.modelo_aprovado_id).maybeSingle()
      : Promise.resolve({ data: null }),
    listarSinalizacoes(supabase, id),
    supabase.from('clientes').select('*').eq('id', documento.cliente_id).single(),
    supabase.from('tipos_peca').select('*').eq('id', documento.tipo_peca_id).single(),
    supabase.from('usuarios').select('*').eq('id', documento.autor_id).single(),
  ]);

  const modeloAprovado = modeloResp.data as ModeloAprovado | null;
  const alinhamento = alinharClausulas(modeloAprovado?.clausulas ?? [], documento.clausulas);

  return (
    <ChecagemView
      documento={documento}
      cliente={clienteResp.data as Cliente}
      tipoPeca={tipoPecaResp.data as TipoPeca}
      autor={autorResp.data as Usuario}
      modeloAprovado={modeloAprovado}
      alinhamento={alinhamento}
      sinalizacoesEstiloIniciais={sinalizacoes.filter((s) => s.natureza === 'estilo')}
      sinalizacoesContextoIniciais={sinalizacoes.filter((s) => s.natureza === 'contexto_negocio')}
    />
  );
}
