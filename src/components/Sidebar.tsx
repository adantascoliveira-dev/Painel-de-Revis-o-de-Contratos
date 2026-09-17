'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Notificacoes } from '@/components/Notificacoes';
import { criarClienteNavegador } from '@/lib/supabase/browser';
import type { Notificacao, Usuario } from '@/types/database.types';

const ICONES = {
  novo: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  ),
  checagem: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="1" /><path d="M12 3v18" />
    </svg>
  ),
  revisao: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  ),
  historico: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M17 11a3 3 0 1 0 0-6" /><path d="M18.5 20a6 6 0 0 0-3-5.2" />
    </svg>
  ),
};

const ITENS = [
  { href: '/novo-documento', label: 'Novo documento', icone: 'novo' as const, contador: undefined as 'emChecagem' | 'aguardandoSocio' | undefined },
  { href: '/documentos?status=em_checagem', label: 'Comparação e checagem', icone: 'checagem' as const, contador: 'emChecagem' as const },
  { href: '/documentos?status=aguardando_socio', label: 'Revisão final', icone: 'revisao' as const, contador: 'aguardandoSocio' as const },
  { href: '/historico', label: 'Histórico e equipe', icone: 'historico' as const, contador: undefined },
];

const ROTULO_PERFIL: Record<Usuario['perfil'], string> = {
  socio: 'Sócio responsável',
  advogado: 'Advogado',
  estagiario: 'Estagiário',
};

export function Sidebar({
  usuario,
  contadores,
  notificacoesIniciais,
}: {
  usuario: Usuario;
  contadores: { emChecagem: number; aguardandoSocio: number };
  notificacoesIniciais: Notificacao[];
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function sair() {
    await criarClienteNavegador().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const iniciais = usuario.nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <aside
      style={{
        width: 256, flex: 'none', background: '#102B4E', color: '#FFFFFF',
        display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, alignSelf: 'flex-start', height: '100vh',
      }}
    >
      <div style={{ padding: '26px 22px 22px', borderBottom: '1px solid rgba(255,255,255,0.14)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <Image src="/assets/logo-horizontal-negativa.png" alt="Braga e Dantas Advogados" width={190} height={46} priority />
          <Notificacoes iniciais={notificacoesIniciais} />
        </div>
        <div style={{ marginTop: 16, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#B6A9A6', fontWeight: 600 }}>
          Painel de revisão
        </div>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.86)', letterSpacing: '-0.01em' }}>Minutas e peças</div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '16px 12px', flex: 1 }}>
        {ITENS.map((item) => {
          const ativo = pathname.startsWith(item.href.split('?')[0]) && (item.href !== '/novo-documento' || pathname === '/novo-documento');
          const contador = item.contador ? contadores[item.contador] : undefined;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 11, width: '100%',
                padding: '11px 12px', cursor: 'pointer', textAlign: 'left',
                fontFamily: 'inherit', fontSize: 13.5, fontWeight: ativo ? 600 : 400,
                letterSpacing: '-0.005em', textDecoration: 'none',
                color: ativo ? '#FFFFFF' : 'rgba(255,255,255,0.72)',
                background: ativo ? 'rgba(255,255,255,0.13)' : 'transparent',
                boxShadow: ativo ? 'inset 2px 0 0 #B6A9A6' : 'none',
              }}
            >
              <span style={{ flex: 'none', display: 'flex' }}>{ICONES[item.icone]}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
              {contador ? <span style={{ fontSize: 11, fontWeight: 600, color: '#B6A9A6' }}>{contador}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '16px 22px 24px', borderTop: '1px solid rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', gap: 11 }}>
        <div
          style={{
            width: 34, height: 34, flex: 'none', border: '1px solid rgba(255,255,255,0.35)',
            display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', color: '#FFFFFF',
          }}
        >
          {iniciais}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{usuario.nome}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{ROTULO_PERFIL[usuario.perfil]}</div>
        </div>
        <button
          type="button"
          onClick={sair}
          title="Sair"
          style={{ background: 'transparent', border: 0, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 4 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
