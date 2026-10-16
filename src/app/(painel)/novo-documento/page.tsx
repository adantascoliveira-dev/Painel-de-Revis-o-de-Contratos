import { criarClienteServidor } from '@/lib/supabase/server';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { NovoDocumentoForm, type FichaPorTipo } from './NovoDocumentoForm';
import type { Cliente, TipoPeca, Usuario } from '@/types/database.types';

export default async function NovoDocumentoPage() {
  const supabase = await criarClienteServidor();
  const usuarioAtual = await exigirUsuarioAtual(supabase);

  const [{ data: tiposPeca }, { data: clientes }, { data: autoresPossiveis }, { data: socios }, { data: guiaAtivo }, { count: totalModelosAprovados }, { data: fichasPorTipo }] =
    await Promise.all([
      supabase.from('tipos_peca').select('*').eq('ativo', true).order('nome'),
      supabase.from('clientes').select('*').eq('ativo', true).order('nome'),
      supabase.from('usuarios').select('*').in('perfil', ['advogado', 'estagiario']).eq('ativo', true).order('nome'),
      supabase.from('usuarios').select('*').eq('perfil', 'socio').eq('ativo', true).order('nome'),
      supabase.from('guias_estilo').select('*').eq('ativo', true).maybeSingle(),
      supabase.from('modelos_aprovados').select('id', { count: 'exact', head: true }).eq('ativo', true),
      supabase.from('fichas_conhecimento').select('tipo_peca_id, subtipo, polo').eq('escopo', 'tipo').eq('ativa', true).not('validada_em', 'is', null),
    ]);

  return (
    <NovoDocumentoForm
      usuarioAtual={usuarioAtual}
      tiposPeca={(tiposPeca ?? []) as TipoPeca[]}
      clientes={(clientes ?? []) as Cliente[]}
      autoresPossiveis={(autoresPossiveis ?? []) as Usuario[]}
      socios={(socios ?? []) as Usuario[]}
      versaoGuia={guiaAtivo?.versao ?? null}
      totalModelosAprovados={totalModelosAprovados ?? 0}
      fichasPorTipo={(fichasPorTipo ?? []) as FichaPorTipo[]}
    />
  );
}
