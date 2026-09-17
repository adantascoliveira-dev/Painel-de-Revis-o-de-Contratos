'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Notificacao } from '@/types/database.types';

/** Pra onde o clique numa notificação leva, de acordo com o tipo (evita precisar buscar o status do documento). */
const DESTINO_POR_TIPO: Record<Notificacao['tipo'], (documentoId: string) => string> = {
  documento_aguardando_socio: (id) => `/documentos/${id}/revisao`,
  pedido_ajuste_equipe: (id) => `/documentos/${id}/checagem`,
  documento_aprovado: (id) => `/documentos/${id}/revisao`,
  analise_contexto_concluida: (id) => `/documentos/${id}/checagem`,
  reconciliacao_pendente: () => `/reconciliacao`,
};

function formatarRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

export function Notificacoes({ iniciais }: { iniciais: Notificacao[] }) {
  const router = useRouter();
  const [notificacoes, setNotificacoes] = useState(iniciais);
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  useEffect(() => {
    function aoClicarFora(evento: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(evento.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  async function alternarAberto() {
    const vaiAbrir = !aberto;
    setAberto(vaiAbrir);
    if (vaiAbrir) {
      const resp = await fetch('/api/notificacoes');
      if (resp.ok) {
        const corpo = (await resp.json()) as { notificacoes: Notificacao[] };
        setNotificacoes(corpo.notificacoes);
      }
    }
  }

  function selecionar(notificacao: Notificacao) {
    if (!notificacao.lida) {
      setNotificacoes((atual) => atual.map((n) => (n.id === notificacao.id ? { ...n, lida: true } : n)));
      fetch(`/api/notificacoes/${notificacao.id}`, { method: 'PATCH' }).catch(() => {});
    }
    setAberto(false);
    if (notificacao.documento_id) {
      router.push(DESTINO_POR_TIPO[notificacao.tipo](notificacao.documento_id));
    }
  }

  function marcarTodasComoLidas() {
    setNotificacoes((atual) => atual.map((n) => ({ ...n, lida: true })));
    fetch('/api/notificacoes', { method: 'PATCH' }).catch(() => {});
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={alternarAberto}
        title="Notificações"
        style={{
          position: 'relative', background: 'transparent', border: 0, color: 'rgba(255,255,255,0.75)',
          cursor: 'pointer', padding: 6, display: 'flex',
        }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {naoLidas > 0 ? (
          <span
            style={{
              position: 'absolute', top: 2, right: 2, minWidth: 15, height: 15, padding: '0 3px', borderRadius: 8,
              background: '#93342B', color: '#FFFFFF', fontSize: 9.5, fontWeight: 700, display: 'grid', placeItems: 'center', lineHeight: 1,
            }}
          >
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        ) : null}
      </button>

      {aberto ? (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 8, width: 320, maxHeight: 420, overflowY: 'auto',
            background: '#FFFFFF', border: '1px solid var(--color-divider)', boxShadow: 'var(--shadow-lg)', zIndex: 60,
          }}
        >
          <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--color-divider)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1C1B22' }}>Notificações</span>
            {naoLidas > 0 ? (
              <button
                type="button"
                onClick={marcarTodasComoLidas}
                style={{ background: 'none', border: 0, fontSize: 11.5, color: 'var(--color-accent)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Marcar todas como lidas
              </button>
            ) : null}
          </div>
          {notificacoes.length === 0 ? (
            <div style={{ padding: '20px 14px', fontSize: 13, color: 'var(--color-muted)' }}>Nenhuma notificação ainda.</div>
          ) : (
            notificacoes.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => selecionar(n)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', border: 0,
                  borderBottom: '1px solid var(--color-divider)', background: n.lida ? '#FFFFFF' : '#F7F1DA',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: n.lida ? 500 : 700, color: '#1C1B22' }}>{n.titulo}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--color-muted)', flex: 'none' }}>{formatarRelativo(n.criado_em)}</span>
                </div>
                {n.corpo ? <div style={{ fontSize: 11.5, color: 'rgba(28,27,34,0.72)', marginTop: 3, lineHeight: 1.45 }}>{n.corpo}</div> : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
