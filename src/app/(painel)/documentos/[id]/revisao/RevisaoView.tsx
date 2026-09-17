'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Corners } from '@/components/Corners';
import { Marca, TextoComMarcas } from '@/components/TextoComMarcas';
import type { PontoJulgamentoHumano } from '@/lib/services/pontos-julgamento-humano';
import type { Cliente, Documento, Sinalizacao, TipoPeca, Usuario } from '@/types/database.types';

const ROTULO_RAZAO: Record<PontoJulgamentoHumano['razao'], string> = {
  decisao_comercial: 'decisão comercial',
  contradicao_historico: 'contradiz o histórico do cliente',
  conflito_regras: 'conflito entre regras do guia',
};

function opcoesPrazo(): { rotulo: string; data: () => string }[] {
  const paraISO = (d: Date) => d.toISOString().slice(0, 10);
  return [
    { rotulo: 'Hoje, até 18h', data: () => paraISO(new Date()) },
    { rotulo: 'Amanhã, até 12h', data: () => paraISO(new Date(Date.now() + 24 * 60 * 60 * 1000)) },
    { rotulo: 'Em 2 dias úteis', data: () => paraISO(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)) },
  ];
}

function DialogPedirAjuste({
  autorNome,
  totalPontosAbertos,
  aoFechar,
  aoEnviar,
}: {
  autorNome: string;
  totalPontosAbertos: number;
  aoFechar: () => void;
  aoEnviar: (observacao: string, prazoIso: string) => void;
}) {
  const opcoes = opcoesPrazo();
  const [observacao, setObservacao] = useState('');
  const [prazoRotulo, setPrazoRotulo] = useState(opcoes[0].rotulo);

  return (
    <div className="dialog-backdrop">
      <div className="dialog blueprint" style={{ background: '#FFFFFF' }}>
        <Corners />
        <div className="dialog-title" style={{ fontSize: 21, letterSpacing: '-0.015em' }}>
          Pedir ajuste à equipe
        </div>
        <div className="dialog-body" style={{ fontSize: 13.5 }}>
          Voltará para <strong style={{ fontWeight: 600 }}>{autorNome}</strong>. Os {totalPontosAbertos} ponto(s) aberto(s) seguem anexados ao pedido.
        </div>
        <div className="field">
          <label>Observação para a equipe</label>
          <textarea
            className="input"
            rows={4}
            placeholder="Rever o teto de responsabilidade antes de reenviar."
            style={{ background: '#FFFFFF' }}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Prazo de retorno</label>
          <select className="input" style={{ background: '#FFFFFF' }} value={prazoRotulo} onChange={(e) => setPrazoRotulo(e.target.value)}>
            {opcoes.map((o) => (
              <option key={o.rotulo} value={o.rotulo}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!observacao.trim()}
            onClick={() => aoEnviar(observacao, opcoes.find((o) => o.rotulo === prazoRotulo)!.data())}
          >
            Enviar pedido
          </button>
        </div>
      </div>
    </div>
  );
}

function DialogCorrigir({
  textoAtual,
  aoFechar,
  aoSalvar,
}: {
  textoAtual: string;
  aoFechar: () => void;
  aoSalvar: (novoTexto: string) => void;
}) {
  const [texto, setTexto] = useState(textoAtual);
  return (
    <div className="dialog-backdrop">
      <div className="dialog blueprint" style={{ background: '#FFFFFF' }}>
        <Corners />
        <div className="dialog-title" style={{ fontSize: 21, letterSpacing: '-0.015em' }}>
          Corrigir diretamente
        </div>
        <div className="dialog-body" style={{ fontSize: 13.5 }}>
          A edição substitui o trecho selecionado e entra no histórico de correções vinculado ao autor da minuta.
        </div>
        <div className="field">
          <label>Novo texto</label>
          <textarea className="input" rows={6} style={{ background: '#FFFFFF' }} value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" disabled={!texto.trim()} onClick={() => aoSalvar(texto)}>
            Salvar correção
          </button>
        </div>
      </div>
    </div>
  );
}

export function RevisaoView({
  usuarioAtual,
  documento,
  cliente,
  tipoPeca,
  autor,
  sinalizacoesPendentesIniciais,
  sinalizacoesResolvidas,
  pontosDeJulgamentoHumano,
}: {
  usuarioAtual: Usuario;
  documento: Documento;
  cliente: Cliente;
  tipoPeca: TipoPeca;
  autor: Usuario;
  sinalizacoesPendentesIniciais: Sinalizacao[];
  sinalizacoesResolvidas: Sinalizacao[];
  pontosDeJulgamentoHumano: PontoJulgamentoHumano[];
}) {
  const router = useRouter();
  const [pendentes] = useState(sinalizacoesPendentesIniciais);
  const [mostrarResolvidos, setMostrarResolvidos] = useState(true);
  const [dialogAjusteAberto, setDialogAjusteAberto] = useState(false);
  const [corrigindo, setCorrigindo] = useState<{ offsetInicio: number; offsetFim: number; textoAtual: string; sinalizacaoOrigemId: string | null } | null>(
    null
  );
  const [promoverAModelo, setPromoverAModelo] = useState(false);
  const [codigoModelo, setCodigoModelo] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const aprovado = documento.status === 'aprovado';
  const ehSocioResponsavel = usuarioAtual.perfil === 'socio' && usuarioAtual.id === documento.socio_revisor_id;
  const totalTratados = sinalizacoesResolvidas.length;

  const marcas: Marca[] = useMemo(() => {
    const lista: Marca[] = [];
    if (mostrarResolvidos) {
      for (const s of sinalizacoesResolvidas) {
        lista.push({
          id: `resolvida-${s.id}`,
          offsetInicio: s.offset_inicio,
          offsetFim: s.offset_fim,
          estilo: { background: '#EFEAE7', boxShadow: 'inset 0 -2px 0 #7A6A65' },
        });
      }
    }
    for (const ponto of pontosDeJulgamentoHumano) {
      lista.push({
        id: `ponto-${ponto.offset_inicio}-${ponto.offset_fim}`,
        offsetInicio: ponto.offset_inicio,
        offsetFim: ponto.offset_fim,
        estilo: { background: '#E4EAF1', boxShadow: 'inset 0 -2px 0 #102B4E' },
      });
    }
    return lista;
  }, [mostrarResolvidos, sinalizacoesResolvidas, pontosDeJulgamentoHumano]);

  function abrirCorrecaoNoOffset(offsetInicio: number, offsetFim: number, sinalizacaoOrigemId: string | null) {
    if (!ehSocioResponsavel || documento.status !== 'aguardando_socio') return;
    setCorrigindo({ offsetInicio, offsetFim, textoAtual: documento.texto_trabalho.slice(offsetInicio, offsetFim), sinalizacaoOrigemId });
  }

  async function salvarCorrecao(novoTexto: string) {
    if (!corrigindo) return;
    setProcessando(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/revisao/${documento.id}/corrigir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offsetInicio: corrigindo.offsetInicio,
          offsetFim: corrigindo.offsetFim,
          textoAntes: corrigindo.textoAtual,
          textoDepois: novoTexto,
          sinalizacaoOrigemId: corrigindo.sinalizacaoOrigemId ?? undefined,
        }),
      });
      const corpo = await resp.json();
      if (!resp.ok) throw new Error(corpo.erro ?? 'Falha ao salvar a correção.');
      setCorrigindo(null);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setProcessando(false);
    }
  }

  async function aprovar() {
    setProcessando(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/revisao/${documento.id}/aprovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promoverAModelo ? { promoverAModelo: true, codigoModelo } : {}),
      });
      const corpo = await resp.json();
      if (!resp.ok) throw new Error(corpo.erro ?? 'Falha ao aprovar o documento.');
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setProcessando(false);
    }
  }

  async function pedirAjuste(observacao: string, prazoIso: string) {
    setProcessando(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/revisao/${documento.id}/pedir-ajuste`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacao, prazo: prazoIso }),
      });
      const corpo = await resp.json();
      if (!resp.ok) throw new Error(corpo.erro ?? 'Falha ao pedir ajuste.');
      setDialogAjusteAberto(false);
      router.push('/documentos?status=em_ajuste_pela_equipe');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado.');
      setProcessando(false);
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
            Etapa 3 de 3 · mesa do sócio
          </div>
          <h1 style={{ fontSize: 34, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Revisão final</h1>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--color-muted)' }}>
            {tipoPeca.nome} · {cliente.nome} · v{documento.versao} · {autor.nome}
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--color-muted)' }}>
          <div>
            <span style={{ color: '#1C1B22', fontWeight: 600, fontSize: 15 }}>{totalTratados}</span> pontos tratados na checagem
          </div>
          <div>
            <span style={{ color: '#7A6A65', fontWeight: 600, fontSize: 15 }}>{pontosDeJulgamentoHumano.length}</span> exigem julgamento humano
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <a href={`/api/documentos/${documento.id}/exportar?formato=docx`} className="btn btn-secondary" style={{ fontSize: 12.5 }}>
              Baixar .docx
            </a>
            <a href={`/api/documentos/${documento.id}/exportar?formato=pdf`} className="btn btn-secondary" style={{ fontSize: 12.5 }}>
              Baixar .pdf
            </a>
          </div>
        </div>
      </header>

      {aprovado ? (
        <div style={{ padding: '16px 40px', background: '#102B4E', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 12, fontSize: 14 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B6A9A6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
          <span>
            <strong style={{ fontWeight: 600 }}>Documento aprovado.</strong> A versão final foi registrada e o histórico de correções foi vinculado a {autor.nome}.
          </span>
        </div>
      ) : null}

      {erro ? <div style={{ padding: '12px 40px 0', fontSize: 13, color: '#93342B' }}>{erro}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 0, borderBottom: '1px solid var(--color-divider)' }}>
        <section style={{ borderRight: '1px solid var(--color-divider)', minWidth: 0, background: '#FFFFFF', padding: '30px 40px 44px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingBottom: 16, marginBottom: 24, borderBottom: '1px solid var(--color-divider)', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{documento.titulo} — revisado</div>
            <label className="radio" style={{ gap: 9, fontSize: 12.5 }}>
              <input type="checkbox" checked={mostrarResolvidos} onChange={(e) => setMostrarResolvidos(e.target.checked)} />
              <span className="dot" style={{ borderRadius: 0 }} />
              Mostrar pontos já resolvidos
            </label>
          </div>

          <div style={{ fontSize: 13.5, lineHeight: 1.95, color: 'rgba(28,27,34,0.85)' }}>
            <TextoComMarcas
              texto={documento.texto_trabalho}
              marcas={marcas}
              aoSelecionar={(id) => {
                const marca = marcas.find((m) => m.id === id);
                if (!marca) return;
                const origemSinalizacao = pendentes.find((s) => s.offset_inicio === marca.offsetInicio && s.offset_fim === marca.offsetFim);
                abrirCorrecaoNoOffset(marca.offsetInicio, marca.offsetFim, origemSinalizacao?.id ?? null);
              }}
            />
          </div>

          <div style={{ marginTop: 30, paddingTop: 20, borderTop: '1px solid var(--color-divider)', display: 'flex', gap: 22, flexWrap: 'wrap', fontSize: 12, color: 'var(--color-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 22, height: 9, background: '#EFEAE7', borderBottom: '1px solid #7A6A65', display: 'inline-block' }} />
              Resolvido na checagem
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 22, height: 9, background: '#E4EAF1', borderBottom: '1px solid #102B4E', display: 'inline-block' }} />
              Aguarda decisão do sócio
            </span>
          </div>
        </section>

        <aside style={{ minWidth: 0, background: '#EAE7E3', padding: '24px 24px 40px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(28,27,34,0.65)', fontWeight: 600, marginBottom: 12 }}>
              Pontos que exigem julgamento
            </div>
            {pontosDeJulgamentoHumano.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>Nenhum ponto exige julgamento humano — tudo tratado na checagem.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pontosDeJulgamentoHumano.map((ponto, i) => (
                  <div key={i} className="blueprint" style={{ padding: 15, background: '#FFFFFF' }}>
                    <Corners />
                    <div style={{ fontSize: 11, color: '#7A6A65', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>
                      {ponto.clausula_numero ? `Cláusula ${ponto.clausula_numero} · ` : ''}
                      {ROTULO_RAZAO[ponto.razao]}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 7 }}>{ponto.trecho.slice(0, 80)}</div>
                    <p style={{ fontSize: 12.5, lineHeight: 1.65, color: 'rgba(28,27,34,0.72)' }}>{ponto.contexto.descricao}</p>
                    {ponto.contexto.o_que_o_modelo_diz ? (
                      <p style={{ fontSize: 12, lineHeight: 1.6, color: 'rgba(28,27,34,0.65)', marginTop: 8 }}>
                        <strong>Modelo:</strong> {ponto.contexto.o_que_o_modelo_diz.slice(0, 140)}
                      </p>
                    ) : null}
                    {ponto.contexto.o_que_contratos_anteriores_fizeram?.length ? (
                      <p style={{ fontSize: 12, lineHeight: 1.6, color: 'rgba(28,27,34,0.65)', marginTop: 8 }}>
                        <strong>Histórico:</strong>{' '}
                        {ponto.contexto.o_que_contratos_anteriores_fizeram.map((v) => `${v.valor} (${v.ocorrencias}×)`).join(', ')}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {ehSocioResponsavel && documento.status === 'aguardando_socio' ? (
            <div style={{ paddingTop: 20, borderTop: '1px solid var(--color-divider)', display: 'flex', flexDirection: 'column', gap: 9 }}>
              <label className="radio" style={{ gap: 8, fontSize: 12.5 }}>
                <input type="checkbox" checked={promoverAModelo} onChange={(e) => setPromoverAModelo(e.target.checked)} />
                <span className="dot" style={{ borderRadius: 0 }} />
                Promover a modelo aprovado
              </label>
              {promoverAModelo ? (
                <input
                  className="input"
                  placeholder="Código do modelo (ex.: MOD-PC-012)"
                  value={codigoModelo}
                  onChange={(e) => setCodigoModelo(e.target.value)}
                />
              ) : null}
              <button
                type="button"
                className="btn btn-primary btn-block"
                style={{ height: 46, fontSize: 15 }}
                disabled={processando || (promoverAModelo && !codigoModelo.trim())}
                onClick={aprovar}
              >
                Aprovar documento
              </button>
              <button type="button" className="btn btn-secondary btn-block" style={{ height: 42, background: '#FFFFFF' }} onClick={() => setDialogAjusteAberto(true)}>
                Pedir ajuste à equipe
              </button>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4, lineHeight: 1.6 }}>
                Clique em um trecho destacado no texto para corrigi-lo diretamente. Correções feitas aqui entram no histórico e no perfil de {autor.nome}.
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      {dialogAjusteAberto ? (
        <DialogPedirAjuste
          autorNome={autor.nome}
          totalPontosAbertos={pontosDeJulgamentoHumano.length}
          aoFechar={() => setDialogAjusteAberto(false)}
          aoEnviar={pedirAjuste}
        />
      ) : null}

      {corrigindo ? <DialogCorrigir textoAtual={corrigindo.textoAtual} aoFechar={() => setCorrigindo(null)} aoSalvar={salvarCorrecao} /> : null}
    </div>
  );
}
