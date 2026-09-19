import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { listarPastasDeClientes } from '@/lib/integrations/google-drive';
import { sincronizarFontesReconciliacao } from '@/lib/services/reconciliacao';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { criarClienteServidor } from '@/lib/supabase/server';

// Rede de segurança além da paralelização em listarPastasDeClientes e
// sincronizarFontesReconciliacao — já vimos essa raiz passar de 100 pastas em
// produção, e sequencial (a versão anterior) estourava o tempo de resposta.
export const maxDuration = 60;

/**
 * Lê a árvore de planejamento patrimonial e sucessório no Google Drive e
 * alimenta a tela de reconciliação. Não escreve em "clientes" diretamente.
 */
export async function POST() {
  try {
    const supabase = await criarClienteServidor();
    const usuario = await exigirUsuarioAtual(supabase);
    if (usuario.perfil !== 'socio') {
      return NextResponse.json({ erro: 'Só o sócio dispara a sincronização com o Google Drive.' }, { status: 403 });
    }

    const pastas = await listarPastasDeClientes();
    const resultado = await sincronizarFontesReconciliacao(criarClienteAdmin(), { googleDrive: pastas });
    return NextResponse.json({ candidatosLidos: pastas.length, ...resultado });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
