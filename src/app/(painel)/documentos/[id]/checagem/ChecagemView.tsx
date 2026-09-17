'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Marca, TextoComMarcas } from '@/components/TextoComMarcas';
import { METADADOS_CATEGORIA } from '@/lib/categorias';
import type { ParClausulas } from '@/lib/extracao/alinhamento';
import type { Cliente, Documento, ModeloAprovado, Sinalizacao, TipoPeca, Usuario } from '@/types/database.types';
import { calcularContadoresChecagem } from '@/lib/services/sinalizacoes';

function SinalizacaoCard({
  sinalizacao,
  ativa,
  onSelecionar,
  onResolver,
}: {
  sinalizacao: Sinalizacao;
  ativa: boolean;
  onSelecionar: () => void;
  onResolver: (resolucao: 'aplicada' | 'mantida') => void;
}) {
  const meta = METADADOS_CATEGORIA[sinalizacao.categoria];
  const resolvida = sinalizacao.resolucao !== 'pendente';

  return (
    <div
      onClick={onSelecionar}
      style={{
        padding: 15, background: '#FFFFFF', cursor: 'pointer',
        border: `1px solid ${ativa ? meta.linha : 'var(--color-divider)'}`,
        boxShadow: ativa ? `inset 3px 0 0 ${meta.linha}` : 'none',
        opacity: resolvida ? 0.72 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 9 }}>
        <span className="tag" style={{ background: meta.bg, color: meta.ink }}>
          {meta.rotulo}
        </span>
        {sinalizacao.clausula_numero ? (
          <span style={{ fontSize: 11, color: 'rgba(28,27,34,0.65)', fontWeight: 500 }}>Cláusula {sinalizacao.clausula_numero}</span>
        ) : null}
      </div>
      {sinalizacao.trecho_original ? (
        <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'rgba(28,27,34,0.65)', textDecoration: 'line-through', marginBottom: 6 }}>
          {sinalizacao.trecho_original}
        </div>
      ) : null}
      <div style={{ fontSize: 13, lineHeight: 1.6, fontWeight: 500, color: '#102B4E', marginBottom: 9 }}>
        {sinalizacao.texto_sugestao_editado ?? sinalizacao.sugestao_ajuste}
      </div>
      <div style={{ fontSize: 11.5, lineHeight: 1.6, color: 'rgba(28,27,34,0.62)', paddingTop: 9, borderTop: '1px solid rgba(28,27,34,0.12)' }}>
        {sinalizacao.justificativa}
      </div>
      {!resolvida ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn btn-primary" style={{ flex: 1, fontSize: 12.5 }} onClick={() => onResolver('aplicada')}>
            Aplicar ajuste
          </button>
          <button type="button" className="btn btn-secondary" style={{ fontSize: 12.5 }} onClick={() => onResolver('mantida')}>
            Manter
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 11, fontSize: 12, fontWeight: 600, color: meta.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
          {sinalizacao.resolucao === 'aplicada' ? 'Ajuste aplicado' : 'Redação mantida'}
        </div>
      )}
    </div>
  );
}

export function ChecagemView({
  documento,
  cliente,
  tipoPeca,
  autor,
  modeloAprovado,
  alinhamento,
  sinalizacoesEstiloIniciais,
  sinalizacoesContextoIniciais,
}: {
  documento: Documento;
  cliente: Cliente;
  tipoPeca: TipoPeca;
  autor: Usuario;
  modeloAprovado: ModeloAprovado | null;
  alinhamento: ParClausulas[];
  sinalizacoesEstiloIniciais: Sinalizacao[];
  sinalizacoesContextoIniciais: Sinalizacao[];
}) {
  const router = useRouter();
  const [estilo, setEstilo] = useState(sinalizacoesEstiloIniciais);
  const [contexto, setContexto] = useState(sinalizacoesContextoIniciais);
  const [ativaId, setAtivaId] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const todas = useMemo(() => [...estilo, ...contexto], [estilo, contexto]);
  const contadores = useMemo(() => calcularContadoresChecagem(todas), [todas]);

  function atualizarSinalizacao(atualizada: Sinalizacao) {
    const atualizarLista = (lista: Sinalizacao[]) => lista.map((s) => (s.id === atualizada.id ? atualizada : s));
    setEstilo(atualizarLista);
    setContexto(atualizarLista);
  }

  async function resolver(sinalizacaoId: string, resolucao: 'aplicada' | 'mantida') {
    setProcessando(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/sinalizacoes/${sinalizacaoId}/resolver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolucao }),
      });
      const corpo = await resp.json();
      if (!resp.ok) throw new Error(corpo.erro ?? 'Falha ao resolver a sinalização.');
      atualizarSinalizacao(corpo.sinalizacao as Sinalizacao);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setProcessando(false);
    }
  }

  async function aplicarTodos() {
    setProcessando(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/documentos/${documento.id}/sinalizacoes/aplicar-lote`, { method: 'POST' });
      const corpo = await resp.json();
      if (!resp.ok) throw new Error(corpo.erro ?? 'Falha ao aplicar os ajustes.');
      router.refresh();
      window.location.reload();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado.');
      setProcessando(false);
    }
  }

  async function enviarAoSocio() {
    setProcessando(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/documentos/${documento.id}/transicao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusNovo: 'aguardando_socio' }),
      });
      const corpo = await resp.json();
      if (!resp.ok) throw new Error(corpo.erro ?? 'Falha ao enviar ao sócio.');
      router.push(`/documentos/${documento.id}/revisao`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado.');
      setProcessando(false);
    }
  }

  const marcasMinuta: Marca[] = todas
    .filter((s) => s.resolucao === 'pendente')
    .map((s) => {
      const meta = METADADOS_CATEGORIA[s.categoria];
      return {
        id: s.id,
        offsetInicio: s.offset_inicio,
        offsetFim: s.offset_fim,
        estilo: { background: meta.bg, boxShadow: `inset 0 -2px 0 ${ativaId === s.id ? meta.ink : meta.linha}` },
        rotuloInsercao: s.categoria === 'clausulas_ausentes' ? '+ cláusula ausente' : undefined,
      };
    });

  return (
    <div>
      <header style={{ padding: '34px 40px 24px', borderBottom: '1px solid var(--color-divider)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A6A65', fontWeight: 600, marginBottom: 8 }}>
              Etapa 2 de 3
            </div>
            <h1 style={{ fontSize: 34, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Comparação e checagem</h1>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--color-muted)' }}>
              {tipoPeca.nome} · {cliente.nome} · v{documento.versao} · {autor.nome}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/documentos" className="btn btn-secondary">
              Voltar
            </Link>
            {documento.status === 'em_checagem' ? (
              <button type="button" className="btn btn-primary" onClick={enviarAoSocio} disabled={processando}>
                Enviar ao sócio
              </button>
            ) : null}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 28, marginTop: 22, flexWrap: 'wrap', fontSize: 13 }}>
          <div>
            <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>{contadores.desviosEmAberto}</span>{' '}
            <span style={{ color: 'rgba(28,27,34,0.6)' }}>desvios de estilo em aberto</span>
          </div>
          <div>
            <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', color: '#A68A11' }}>{contadores.pontosDeContexto}</span>{' '}
            <span style={{ color: 'rgba(28,27,34,0.6)' }}>pontos de contexto do cliente</span>
          </div>
          <div>
            <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>{contadores.ajustesAplicados}</span>{' '}
            <span style={{ color: 'rgba(28,27,34,0.6)' }}>ajustes aplicados</span>
          </div>
          <div>
            <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>{contadores.percentualAderencia}%</span>{' '}
            <span style={{ color: 'rgba(28,27,34,0.6)' }}>de aderência ao modelo{modeloAprovado ? ` ${modeloAprovado.codigo}` : ''}</span>
          </div>
        </div>
        {erro ? <div style={{ marginTop: 12, fontSize: 13, color: '#93342B' }}>{erro}</div> : null}
        {!modeloAprovado ? (
          <div style={{ marginTop: 12, fontSize: 13, color: '#6E5A08' }}>
            Nenhum modelo aprovado para este tipo de peça — a checagem seguiu só com as regras do guia de estilo.
          </div>
        ) : null}
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 0, alignItems: 'stretch', borderBottom: '1px solid var(--color-divider)' }}>
        <section style={{ borderRight: '1px solid var(--color-divider)', minWidth: 0 }}>
          <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--color-divider)', background: '#EAE7E3', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(28,27,34,0.65)', fontWeight: 600 }}>Modelo aprovado</div>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {modeloAprovado ? `${modeloAprovado.codigo} · ${tipoPeca.nome}` : 'Sem modelo aprovado'}
              </div>
            </div>
            <span className="tag tag-neutral" style={{ flex: 'none' }}>
              Referência
            </span>
          </div>
          <div style={{ padding: '26px 24px 34px', fontSize: 13.5, lineHeight: 1.85, color: 'rgba(28,27,34,0.82)' }}>
            {!modeloAprovado ? (
              'Sem modelo aprovado para comparar — a checagem rodou só com as regras do guia de estilo.'
            ) : alinhamento.length === 0 ? (
              <div style={{ whiteSpace: 'pre-wrap' }}>{modeloAprovado.texto}</div>
            ) : (
              alinhamento.map((par, i) => (
                <div key={i} style={{ marginBottom: 18 }}>
                  {par.numero ? (
                    <h4 style={{ margin: '0 0 6px', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#102B4E' }}>
                      Cláusula {par.numero}
                    </h4>
                  ) : null}
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {par.clausulaModelo ? par.clausulaModelo.texto : <span style={{ color: 'rgba(28,27,34,0.45)', fontStyle: 'italic' }}>— não existe no modelo —</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section style={{ borderRight: '1px solid var(--color-divider)', minWidth: 0, background: '#FFFFFF' }}>
          <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--color-divider)', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A6A65', fontWeight: 600 }}>Minuta enviada</div>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{documento.titulo}</div>
            </div>
            <span className="tag tag-accent" style={{ flex: 'none' }}>
              Em checagem
            </span>
          </div>
          <div style={{ padding: '26px 24px 34px', fontSize: 13.5, lineHeight: 1.95 }}>
            {alinhamento.length === 0 || !modeloAprovado ? (
              <TextoComMarcas texto={documento.texto_trabalho} marcas={marcasMinuta} aoSelecionar={setAtivaId} />
            ) : (
              alinhamento.map((par, i) => (
                <div key={i} style={{ marginBottom: 18 }}>
                  {par.numero ? (
                    <h4 style={{ margin: '0 0 6px', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#102B4E' }}>
                      Cláusula {par.numero}
                    </h4>
                  ) : null}
                  {par.clausulaMinuta ? (
                    <TextoComMarcas
                      texto={par.clausulaMinuta.texto}
                      marcas={marcasMinuta
                        .filter((m) => m.offsetInicio >= par.clausulaMinuta!.offset_inicio && m.offsetFim <= par.clausulaMinuta!.offset_fim)
                        .map((m) => ({ ...m, offsetInicio: m.offsetInicio - par.clausulaMinuta!.offset_inicio, offsetFim: m.offsetFim - par.clausulaMinuta!.offset_inicio }))}
                      aoSelecionar={setAtivaId}
                    />
                  ) : (
                    <span style={{ color: 'rgba(28,27,34,0.45)', fontStyle: 'italic' }}>— não existe na minuta —</span>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <aside style={{ minWidth: 0, background: '#EAE7E3' }}>
          {contexto.length > 0 ? (
            <>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-divider)', background: '#F7F1DA' }}>
                <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6E5A08', fontWeight: 600 }}>
                  Leitura do negócio — {cliente.nome}
                </div>
                <div style={{ fontSize: 11.5, lineHeight: 1.55, color: 'rgba(28,27,34,0.68)', marginTop: 5 }}>
                  Trechos que tratam o caso do cliente de forma genérica, sem refletir a operação ou a estrutura societária.
                </div>
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {contexto.map((s) => (
                  <SinalizacaoCard key={s.id} sinalizacao={s} ativa={ativaId === s.id} onSelecionar={() => setAtivaId(s.id)} onResolver={(r) => resolver(s.id, r)} />
                ))}
              </div>
            </>
          ) : null}

          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-divider)', borderBottom: '1px solid var(--color-divider)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(28,27,34,0.65)', fontWeight: 600 }}>Desvios do guia de estilo</div>
            {contadores.desviosEmAberto > 0 ? (
              <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={aplicarTodos} disabled={processando}>
                Aplicar todos
              </button>
            ) : null}
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {estilo.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>Nenhum desvio de estilo encontrado.</p>
            ) : (
              estilo.map((s) => (
                <SinalizacaoCard key={s.id} sinalizacao={s} ativa={ativaId === s.id} onSelecionar={() => setAtivaId(s.id)} onResolver={(r) => resolver(s.id, r)} />
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
