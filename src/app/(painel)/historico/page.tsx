import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { buscarIndicadoresGerais, buscarPerfilUsuario, listarHistoricoCorrecoes } from '@/lib/services/historico';
import { criarClienteServidor } from '@/lib/supabase/server';
import type { VwPerfilUsuario } from '@/types/database.types';
import { HistoricoView } from './HistoricoView';

export default async function HistoricoPage() {
  const supabase = await criarClienteServidor();
  const usuarioAtual = await exigirUsuarioAtual(supabase);

  const [indicadores, correcoes, { data: perfisResumo }] = await Promise.all([
    buscarIndicadoresGerais(supabase),
    listarHistoricoCorrecoes(supabase),
    supabase.from('vw_perfil_usuario').select('*').order('nome'),
  ]);

  const listaPerfis = (perfisResumo ?? []) as VwPerfilUsuario[];
  const perfilInicial = listaPerfis[0] ? await buscarPerfilUsuario(supabase, listaPerfis[0].usuario_id) : null;

  return (
    <HistoricoView
      usuarioAtual={usuarioAtual}
      indicadores={indicadores}
      correcoesIniciais={correcoes}
      perfisResumo={listaPerfis}
      perfilInicial={perfilInicial}
    />
  );
}
