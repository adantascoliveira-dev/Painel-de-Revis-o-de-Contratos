import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { listarListasComoClientesCandidatos } from '@/lib/integrations/clickup';
import { sincronizarFontesReconciliacao } from '@/lib/services/reconciliacao';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { criarClienteServidor } from '@/lib/supabase/server';

// Rede de segurança além da paralelização em listarListasComoClientesCandidatos
// e sincronizarFontesReconciliacao — workspaces grandes não devem, mas se
// baterem no limite padrão do plano é melhor um erro claro do que a conexão
// cair no meio da sincronização.
export const maxDuration = 60;

/** Lê a base de clientes/demandas do ClickUp e alimenta a tela de reconciliação. */
export async function POST() {
  try {
    const supabase = await criarClienteServidor();
    const usuario = await exigirUsuarioAtual(supabase);
    if (usuario.perfil !== 'socio') {
      return NextResponse.json({ erro: 'Só o sócio dispara a sincronização com o ClickUp.' }, { status: 403 });
    }

    const listas = await listarListasComoClientesCandidatos();
    const resultado = await sincronizarFontesReconciliacao(criarClienteAdmin(), { clickUp: listas });
    return NextResponse.json({ candidatosLidos: listas.length, ...resultado });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
