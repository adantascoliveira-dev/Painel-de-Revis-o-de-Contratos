'use client';

import { useState } from 'react';
import { Corners } from '@/components/Corners';
import type { Cliente, FonteReconciliacaoRow, TipoCliente, Usuario } from '@/types/database.types';

export type FontePendente = FonteReconciliacaoRow & { cliente_sugerido: { id: string; nome: string } | null };

const ROTULO_FONTE: Record<FonteReconciliacaoRow['fonte'], string> = {
  google_drive: 'Google Drive',
  clickup: 'ClickUp',
  manual: 'Manual',
};

const ROTULO_TIPO_CLIENTE: Record<TipoCliente, string> = {
  holding: 'Holding',
  empresa: 'Empresa',
  pessoa_fisica: 'Pessoa física',
};

function CardPendente({
  fonte,
  clientes,
  podeConfirmar,
  aoResolver,
}: {
  fonte: FontePendente;
  clientes: Pick<Cliente, 'id' | 'nome'>[];
  podeConfirmar: boolean;
  aoResolver: (id: string) => void;
}) {
  const [modo, setModo] = useState<'nenhum' | 'outro' | 'novo'>('nenhum');
  const [clienteEscolhidoId, setClienteEscolhidoId] = useState(clientes[0]?.id ?? '');
  const [novoNome, setNovoNome] = useState(fonte.cliente_candidato_nome);
  const [novoTipo, setNovoTipo] = useState<TipoCliente>('empresa');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(body: Record<string, unknown>) {
    setProcessando(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/integracoes/reconciliacao/${fonte.id}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const corpo = await resp.json();
      if (!resp.ok) throw new Error(corpo.erro ?? 'Falha ao confirmar.');
      aoResolver(fonte.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado.');
      setProcessando(false);
    }
  }

  return (
    <div className="blueprint" style={{ padding: 18, background: '#FFFFFF' }}>
      <Corners />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fonte.cliente_candidato_nome}
          </div>
        </div>
        <span className="tag tag-neutral" style={{ flex: 'none' }}>
          {ROTULO_FONTE[fonte.fonte]}
        </span>
      </div>

      {fonte.cliente_sugerido ? (
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'rgba(28,27,34,0.78)' }}>
          Sugestão: <strong style={{ fontWeight: 600 }}>{fonte.cliente_sugerido.nome}</strong>
          {fonte.similaridade != null ? (
            <span style={{ color: 'var(--color-muted)' }}> ({Math.round(fonte.similaridade * 100)}% de similaridade)</span>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--color-muted)' }}>Nenhuma sugestão automática encontrada.</div>
      )}

      {erro ? <div style={{ marginTop: 10, fontSize: 12.5, color: '#93342B' }}>{erro}</div> : null}

      {!podeConfirmar ? (
        <div style={{ marginTop: 14, fontSize: 12, color: 'var(--color-muted)' }}>Só um sócio pode confirmar o cadastro canônico.</div>
      ) : modo === 'nenhum' ? (
        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {fonte.cliente_sugerido ? (
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: 12.5 }}
              disabled={processando}
              onClick={() => enviar({ clienteId: fonte.cliente_sugerido!.id })}
            >
              Confirmar como {fonte.cliente_sugerido.nome}
            </button>
          ) : null}
          <button type="button" className="btn btn-secondary" style={{ fontSize: 12.5 }} disabled={processando} onClick={() => setModo('outro')}>
            Vincular a outro cliente
          </button>
          <button type="button" className="btn btn-secondary" style={{ fontSize: 12.5 }} disabled={processando} onClick={() => setModo('novo')}>
            Cadastrar como novo cliente
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 12.5, marginLeft: 'auto' }}
            disabled={processando}
            onClick={() => enviar({ status: 'descartado' })}
          >
            Descartar
          </button>
        </div>
      ) : modo === 'outro' ? (
        <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="input" style={{ maxWidth: 240, background: '#FFFFFF' }} value={clienteEscolhidoId} onChange={(e) => setClienteEscolhidoId(e.target.value)}>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: 12.5 }}
            disabled={processando || !clienteEscolhidoId}
            onClick={() => enviar({ clienteId: clienteEscolhidoId })}
          >
            Vincular
          </button>
          <button type="button" className="btn btn-secondary" style={{ fontSize: 12.5 }} disabled={processando} onClick={() => setModo('nenhum')}>
            Cancelar
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              className="input"
              style={{ maxWidth: 240 }}
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Nome do cliente"
            />
            <select className="input" style={{ maxWidth: 160, background: '#FFFFFF' }} value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as TipoCliente)}>
              {(Object.keys(ROTULO_TIPO_CLIENTE) as TipoCliente[]).map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TIPO_CLIENTE[t]}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: 12.5 }}
              disabled={processando || !novoNome.trim()}
              onClick={() => enviar({ novoCliente: { nome: novoNome.trim(), tipo: novoTipo } })}
            >
              Cadastrar e vincular
            </button>
            <button type="button" className="btn btn-secondary" style={{ fontSize: 12.5 }} disabled={processando} onClick={() => setModo('nenhum')}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReconciliacaoView({
  usuarioAtual,
  pendentesIniciais,
  clientes,
}: {
  usuarioAtual: Usuario;
  pendentesIniciais: FontePendente[];
  clientes: Pick<Cliente, 'id' | 'nome'>[];
}) {
  const [pendentes, setPendentes] = useState(pendentesIniciais);
  const [sincronizando, setSincronizando] = useState<'drive' | 'clickup' | null>(null);
  const [mensagemSync, setMensagemSync] = useState<string | null>(null);

  const podeConfirmar = usuarioAtual.perfil === 'socio';
  const podeSincronizar = usuarioAtual.perfil === 'socio';

  function resolver(id: string) {
    setPendentes((atual) => atual.filter((f) => f.id !== id));
  }

  async function sincronizar(fonte: 'drive' | 'clickup') {
    setSincronizando(fonte);
    setMensagemSync(null);
    try {
      const rota = fonte === 'drive' ? '/api/integracoes/google-drive/sync' : '/api/integracoes/clickup/sync';
      const resp = await fetch(rota, { method: 'POST' });
      const corpo = await resp.json();
      if (!resp.ok) throw new Error(corpo.erro ?? 'Falha na sincronização.');
      setMensagemSync(
        `${corpo.candidatosLidos ?? 0} candidato(s) lido(s) — ${corpo.inseridas ?? 0} novo(s), ${corpo.atualizadas ?? 0} atualizado(s).`
      );
      const respLista = await fetch('/api/integracoes/reconciliacao');
      if (respLista.ok) {
        const corpoLista = await respLista.json();
        setPendentes(corpoLista.pendentes);
      }
    } catch (e) {
      setMensagemSync(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setSincronizando(null);
    }
  }

  return (
    <div>
      <header
        style={{
          padding: '34px 40px 26px', borderBottom: '1px solid var(--color-divider)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A6A65', fontWeight: 600, marginBottom: 8 }}>
            Integrações
          </div>
          <h1 style={{ fontSize: 34, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Reconciliação de clientes</h1>
          <p style={{ margin: '8px 0 0', fontSize: 14, maxWidth: '62ch', color: 'var(--color-muted)' }}>
            Candidatos a cliente lidos do Google Drive e do ClickUp. Nada vira cadastro oficial sem confirmação do sócio.
          </p>
        </div>
        {podeSincronizar ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" disabled={sincronizando !== null} onClick={() => sincronizar('drive')}>
              {sincronizando === 'drive' ? 'Sincronizando…' : 'Sincronizar Google Drive'}
            </button>
            <button type="button" className="btn btn-secondary" disabled={sincronizando !== null} onClick={() => sincronizar('clickup')}>
              {sincronizando === 'clickup' ? 'Sincronizando…' : 'Sincronizar ClickUp'}
            </button>
          </div>
        ) : null}
      </header>

      {mensagemSync ? <div style={{ padding: '12px 40px 0', fontSize: 13, color: 'var(--color-muted)' }}>{mensagemSync}</div> : null}

      <div style={{ padding: '24px 40px 40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {pendentes.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>Nenhum candidato pendente no momento.</p>
        ) : (
          pendentes.map((fonte) => (
            <CardPendente key={fonte.id} fonte={fonte} clientes={clientes} podeConfirmar={podeConfirmar} aoResolver={resolver} />
          ))
        )}
      </div>
    </div>
  );
}
