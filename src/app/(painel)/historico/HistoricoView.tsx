'use client';

import { useState } from 'react';
import { METADADOS_CATEGORIA } from '@/lib/categorias';
import { Corners } from '@/components/Corners';
import type { Correcao, Usuario, VwIndicadoresGerais, VwPerfilUsuario } from '@/types/database.types';
import type { PerfilCompleto } from '@/lib/services/historico';

type LinhaHistorico = Correcao & { documentos: { cliente_id: string; tipo_peca_id: string; titulo: string } };

function formatarIntervalo(valor: string | null): string {
  if (!valor) return '—';
  const dias = /(\d+)\s*day/.exec(valor);
  const horas = /(\d{1,2}):(\d{2}):(\d{2})/.exec(valor);
  let minutosTotais = 0;
  if (dias) minutosTotais += Number(dias[1]) * 24 * 60;
  if (horas) minutosTotais += Number(horas[1]) * 60 + Number(horas[2]);
  if (!dias && !horas) {
    const soNumero = Number(valor);
    if (!Number.isNaN(soNumero)) minutosTotais = Math.round(soNumero / 60);
  }
  if (minutosTotais === 0) return '—';
  if (minutosTotais < 60) return `${minutosTotais} min`;
  const h = Math.floor(minutosTotais / 60);
  const m = minutosTotais % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function HistoricoView({
  usuarioAtual,
  indicadores,
  correcoesIniciais,
  perfisResumo,
  perfilInicial,
}: {
  usuarioAtual: Usuario;
  indicadores: VwIndicadoresGerais | null;
  correcoesIniciais: LinhaHistorico[];
  perfisResumo: VwPerfilUsuario[];
  perfilInicial: PerfilCompleto | null;
}) {
  const [correcoes] = useState(correcoesIniciais);
  const [membroSelecionadoId, setMembroSelecionadoId] = useState(perfisResumo[0]?.usuario_id ?? null);
  const [perfil, setPerfil] = useState(perfilInicial);
  const [carregandoPerfil, setCarregandoPerfil] = useState(false);
  const [observacaoEmEdicao, setObservacaoEmEdicao] = useState(perfilInicial?.observacao ?? '');
  const [salvandoObservacao, setSalvandoObservacao] = useState(false);

  async function selecionarMembro(usuarioId: string) {
    setMembroSelecionadoId(usuarioId);
    setCarregandoPerfil(true);
    try {
      const resp = await fetch(`/api/historico/perfil/${usuarioId}`);
      if (resp.ok) {
        const dados = (await resp.json()) as PerfilCompleto;
        setPerfil(dados);
        setObservacaoEmEdicao(dados.observacao ?? '');
      }
    } finally {
      setCarregandoPerfil(false);
    }
  }

  async function salvarObservacao() {
    if (!membroSelecionadoId) return;
    setSalvandoObservacao(true);
    try {
      await fetch(`/api/historico/perfil/${membroSelecionadoId}/observacao`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: observacaoEmEdicao }),
      });
    } finally {
      setSalvandoObservacao(false);
    }
  }

  const maxPadrao = perfil ? Math.max(1, ...perfil.categorias.map((c) => c.total)) : 1;

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
            Registro contínuo
          </div>
          <h1 style={{ fontSize: 34, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Histórico e perfil da equipe</h1>
          <p style={{ margin: '8px 0 0', fontSize: 14, maxWidth: '62ch', color: 'var(--color-muted)' }}>
            Cada correção do sócio fica vinculada a quem escreveu a minuta, formando o perfil de desvios recorrentes de cada integrante.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/api/historico/correcoes?formato=csv" className="btn btn-secondary" style={{ background: '#FFFFFF' }}>
            Exportar CSV
          </a>
        </div>
      </header>

      <div style={{ padding: '30px 40px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
        <div className="blueprint" style={{ padding: 17, background: '#FFFFFF' }}>
          <Corners />
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 600 }}>Minutas revisadas</div>
          <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 5 }}>{indicadores?.minutas_revisadas_pelo_socio ?? 0}</div>
        </div>
        <div className="blueprint" style={{ padding: 17, background: '#FFFFFF' }}>
          <Corners />
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 600 }}>Correções do sócio</div>
          <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 5 }}>{indicadores?.total_correcoes_socio ?? 0}</div>
        </div>
        <div className="blueprint" style={{ padding: 17, background: '#FFFFFF' }}>
          <Corners />
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 600 }}>Desvio mais comum</div>
          <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.01em', marginTop: 8, color: '#7A6A65' }}>
            {indicadores?.desvio_mais_comum ? METADADOS_CATEGORIA[indicadores.desvio_mais_comum].rotulo : '—'}
          </div>
        </div>
        <div className="blueprint" style={{ padding: 17, background: '#FFFFFF' }}>
          <Corners />
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 600 }}>Tempo médio de revisão</div>
          <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 5 }}>{formatarIntervalo(indicadores?.tempo_medio_revisao ?? null)}</div>
        </div>
      </div>

      <div style={{ padding: '8px 40px 40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 28, alignItems: 'start' }}>
        <section style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: 19, letterSpacing: '-0.015em', marginBottom: 14 }}>Correções registradas</h3>
          <div style={{ border: '1px solid var(--color-divider)', background: '#FFFFFF', overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 16 }}>Data</th>
                  <th>Minuta / autor</th>
                  <th>Categoria</th>
                  <th style={{ paddingRight: 16 }}>Antes → depois</th>
                </tr>
              </thead>
              <tbody>
                {correcoes.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 16, color: 'var(--color-muted)' }}>
                      Nenhuma correção registrada ainda.
                    </td>
                  </tr>
                ) : (
                  correcoes.map((c) => (
                    <tr key={c.id}>
                      <td style={{ paddingLeft: 16, whiteSpace: 'nowrap', fontSize: 12.5, color: 'var(--color-muted)', verticalAlign: 'top' }}>
                        {formatarData(c.criado_em)}
                      </td>
                      <td style={{ verticalAlign: 'top', minWidth: 150 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{c.documentos.titulo}</div>
                      </td>
                      <td style={{ verticalAlign: 'top' }}>
                        {c.categoria ? (
                          <span className="tag" style={{ background: METADADOS_CATEGORIA[c.categoria].bg, color: METADADOS_CATEGORIA[c.categoria].ink }}>
                            {METADADOS_CATEGORIA[c.categoria].rotulo}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ paddingRight: 16, verticalAlign: 'top' }}>
                        <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--color-muted)', textDecoration: 'line-through' }}>{c.texto_antes}</div>
                        <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#102B4E', fontWeight: 500 }}>{c.texto_depois}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: 19, letterSpacing: '-0.015em', marginBottom: 14 }}>Perfil da equipe</h3>

          {perfisResumo.length > 1 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
              {perfisResumo.map((m) => {
                const ativo = m.usuario_id === membroSelecionadoId;
                const iniciais = m.nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
                return (
                  <button
                    key={m.usuario_id}
                    type="button"
                    onClick={() => selecionarMembro(m.usuario_id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 13px', cursor: 'pointer',
                      fontFamily: 'inherit', background: '#FFFFFF', border: `1px solid ${ativo ? '#102B4E' : 'var(--color-divider)'}`,
                      boxShadow: ativo ? 'inset 3px 0 0 #B6A9A6' : 'none',
                    }}
                  >
                    <span
                      style={{
                        width: 32, height: 32, flex: 'none', display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 600,
                        letterSpacing: '0.04em', background: ativo ? '#102B4E' : 'rgba(16,43,78,0.10)', color: ativo ? '#FFFFFF' : '#102B4E',
                      }}
                    >
                      {iniciais}
                    </span>
                    <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 500 }}>{m.nome}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-muted)' }}>{m.perfil}</span>
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>{m.total_correcoes} correções</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {perfil ? (
            <div className="blueprint" style={{ padding: 20, background: '#FFFFFF', opacity: carregandoPerfil ? 0.6 : 1 }}>
              <Corners />
              <div style={{ display: 'flex', alignItems: 'center', gap: 13, paddingBottom: 16, borderBottom: '1px solid rgba(28,27,34,0.14)' }}>
                <div style={{ width: 44, height: 44, flex: 'none', background: '#102B4E', color: '#FFFFFF', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 600, letterSpacing: '0.04em' }}>
                  {perfil.perfil.nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em' }}>{perfil.perfil.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{perfil.perfil.perfil}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, padding: '16px 0', borderBottom: '1px solid rgba(28,27,34,0.14)' }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 600 }}>Minutas</div>
                  <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>{perfil.perfil.volume_minutas}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 600 }}>Correções</div>
                  <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>{perfil.perfil.total_correcoes}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 600 }}>Por minuta</div>
                  <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', color: '#7A6A65' }}>{perfil.perfil.media_correcoes_por_minuta}</div>
                </div>
              </div>

              <div style={{ paddingTop: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 600, marginBottom: 13 }}>
                  Padrões recorrentes
                </div>
                {perfil.categorias.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>Nenhuma correção registrada ainda.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                    {perfil.categorias.map((p) => (
                      <div key={p.categoria}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, marginBottom: 5 }}>
                          <span style={{ fontWeight: 500 }}>{METADADOS_CATEGORIA[p.categoria].rotulo}</span>
                          <span style={{ color: 'var(--color-muted)' }}>{p.total}</span>
                        </div>
                        <div style={{ height: 7, background: 'rgba(28,27,34,0.1)' }}>
                          <div style={{ height: '100%', width: `${Math.round((p.total / maxPadrao) * 100)}%`, background: '#102B4E' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 18, padding: 13, background: 'var(--color-bg)', borderLeft: '2px solid #7A6A65' }}>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A6A65', fontWeight: 600, marginBottom: 6 }}>
                  Observação do sócio
                </div>
                {usuarioAtual.perfil === 'socio' ? (
                  <>
                    <textarea
                      className="input"
                      rows={3}
                      style={{ background: '#FFFFFF', fontSize: 12.5 }}
                      value={observacaoEmEdicao}
                      onChange={(e) => setObservacaoEmEdicao(e.target.value)}
                    />
                    <button type="button" className="btn btn-secondary" style={{ marginTop: 8, fontSize: 12 }} onClick={salvarObservacao} disabled={salvandoObservacao}>
                      {salvandoObservacao ? 'Salvando…' : 'Salvar observação'}
                    </button>
                  </>
                ) : (
                  <p style={{ fontSize: 12.5, lineHeight: 1.65, color: 'rgba(28,27,34,0.78)' }}>{perfil.observacao ?? 'Nenhuma observação registrada.'}</p>
                )}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>Nenhum perfil disponível.</p>
          )}
        </section>
      </div>
    </div>
  );
}
