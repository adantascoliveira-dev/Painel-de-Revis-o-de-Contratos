import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { criarClienteServidor } from '@/lib/supabase/server';
import type { Notificacao } from '@/types/database.types';

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: usuario } = await supabase.from('usuarios').select('*').eq('id', user.id).single();
  if (!usuario) redirect('/login');

  const [{ count: emChecagem }, { count: aguardandoSocio }, { data: notificacoes }] = await Promise.all([
    supabase.from('documentos').select('id', { count: 'exact', head: true }).eq('status', 'em_checagem'),
    supabase.from('documentos').select('id', { count: 'exact', head: true }).eq('status', 'aguardando_socio'),
    supabase.from('notificacoes').select('*').eq('usuario_id', user.id).order('criado_em', { ascending: false }).limit(30),
  ]);

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Sidebar
        usuario={usuario}
        contadores={{ emChecagem: emChecagem ?? 0, aguardandoSocio: aguardandoSocio ?? 0 }}
        notificacoesIniciais={(notificacoes ?? []) as Notificacao[]}
      />
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>{children}</main>
    </div>
  );
}
