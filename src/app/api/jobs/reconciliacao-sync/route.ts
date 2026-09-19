import { NextResponse } from 'next/server';
import { listarListasComoClientesCandidatos } from '@/lib/integrations/clickup';
import { listarPastasDeClientes } from '@/lib/integrations/google-drive';
import { sincronizarFontesReconciliacao } from '@/lib/services/reconciliacao';
import { criarClienteAdmin } from '@/lib/supabase/admin';

// Mesma convenção do worker de contexto do cliente (ver /api/jobs/contexto-cliente):
// CRON_SECRET é injetado automaticamente pelo Cron nativo da Vercel; outros
// agendadores mandam o header na mão.
function autorizado(request: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  return request.headers.get('authorization') === `Bearer ${segredo}`;
}

// Mesma rede de segurança das rotas de sync manual — já vimos a raiz do Drive
// passar de 100 pastas em produção.
export const maxDuration = 60;

/**
 * Sincronização automática de candidatos a cliente (Drive + ClickUp), sem
 * depender de alguém lembrar de clicar "Sincronizar" na tela de reconciliação.
 * Cada fonte falha isoladamente — uma integração fora do ar não deve impedir
 * a outra de rodar. Notifica os sócios só quando há candidato novo de fato,
 * pra não virar ruído a cada execução.
 */
async function sincronizar(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
  }

  const admin = criarClienteAdmin();

  const [pastasDrive, listasClickUp] = await Promise.all([
    listarPastasDeClientes().catch((erro) => {
      console.error('Falha ao ler pastas de clientes no Google Drive:', erro);
      return [];
    }),
    listarListasComoClientesCandidatos().catch((erro) => {
      console.error('Falha ao ler listas de clientes no ClickUp:', erro);
      return [];
    }),
  ]);

  const { inseridas, atualizadas } = await sincronizarFontesReconciliacao(admin, {
    googleDrive: pastasDrive,
    clickUp: listasClickUp,
  });

  if (inseridas > 0) {
    const { data: socios } = await admin.from('usuarios').select('id').eq('perfil', 'socio');
    if (socios && socios.length > 0) {
      await admin.from('notificacoes').insert(
        socios.map((s) => ({
          usuario_id: s.id,
          tipo: 'reconciliacao_pendente' as const,
          titulo: 'Novos candidatos a cliente pra reconciliar',
          corpo: `${inseridas} candidato(s) novo(s) encontrado(s) no Drive/ClickUp.`,
        }))
      );
    }
  }

  return NextResponse.json({ candidatosLidosDrive: pastasDrive.length, candidatosLidosClickUp: listasClickUp.length, inseridas, atualizadas });
}

export async function GET(request: Request) {
  return sincronizar(request);
}

export async function POST(request: Request) {
  return sincronizar(request);
}
