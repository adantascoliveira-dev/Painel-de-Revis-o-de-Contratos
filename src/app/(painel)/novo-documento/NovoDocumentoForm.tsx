'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Corners } from '@/components/Corners';
import { TODAS_AS_CATEGORIAS } from '@/lib/categorias';
import type { Cliente, CategoriaSinalizacao, TipoCliente, TipoPeca, Usuario } from '@/types/database.types';

const ROTULO_GRUPO_CLIENTE: Record<TipoCliente, string> = {
  holding: 'Holdings e participações',
  empresa: 'Empresas e grupos',
  pessoa_fisica: 'Pessoas físicas',
};

function agruparPorChave<T>(itens: T[], chave: (item: T) => string): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const item of itens) {
    const k = chave(item);
    mapa.set(k, [...(mapa.get(k) ?? []), item]);
  }
  return mapa;
}

export function NovoDocumentoForm({
  usuarioAtual,
  tiposPeca,
  clientes,
  autoresPossiveis,
  socios,
  versaoGuia,
  totalModelosAprovados,
}: {
  usuarioAtual: Usuario;
  tiposPeca: TipoPeca[];
  clientes: Cliente[];
  autoresPossiveis: Usuario[];
  socios: Usuario[];
  versaoGuia: string | null;
  totalModelosAprovados: number;
}) {
  const router = useRouter();
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  const [modo, setModo] = useState<'upload' | 'paste'>('upload');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [textoColado, setTextoColado] = useState('');
  const [titulo, setTitulo] = useState('');
  const [tipoPecaId, setTipoPecaId] = useState(tiposPeca[0]?.id ?? '');
  const [clienteId, setClienteId] = useState(clientes[0]?.id ?? '');
  const [autorId, setAutorId] = useState(usuarioAtual.perfil === 'estagiario' ? usuarioAtual.id : autoresPossiveis[0]?.id ?? usuarioAtual.id);
  const [socioRevisorId, setSocioRevisorId] = useState(socios[0]?.id ?? '');
  const [categorias, setCategorias] = useState<Set<CategoriaSinalizacao>>(
    new Set(TODAS_AS_CATEGORIAS.filter((c) => c.marcadaPorPadrao).map((c) => c.valor))
  );
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const gruposTipoPeca = useMemo(() => agruparPorChave(tiposPeca, (t) => t.grupo ?? 'Outros'), [tiposPeca]);
  const gruposClientes = useMemo(() => agruparPorChave(clientes, (c) => c.tipo), [clientes]);

  const podeEscolherAutor = usuarioAtual.perfil === 'advogado' || usuarioAtual.perfil === 'socio';

  function alternarCategoria(valor: CategoriaSinalizacao) {
    setCategorias((atual) => {
      const novo = new Set(atual);
      if (novo.has(valor)) novo.delete(valor);
      else novo.add(valor);
      return novo;
    });
  }

  async function enviarParaChecagem() {
    setErro(null);
    if (!titulo.trim()) return setErro('Dê um título para a minuta.');
    if (!tipoPecaId || !clienteId || !socioRevisorId) return setErro('Preencha tipo de peça, cliente e sócio responsável.');
    if (modo === 'upload' && !arquivo) return setErro('Selecione um arquivo ou troque para "Colar texto".');
    if (modo === 'paste' && !textoColado.trim()) return setErro('Cole o texto da minuta ou troque para "Upload de arquivo".');

    setEnviando(true);
    try {
      const formData = new FormData();
      formData.set('titulo', titulo);
      formData.set('tipoPecaId', tipoPecaId);
      formData.set('clienteId', clienteId);
      formData.set('socioRevisorId', socioRevisorId);
      formData.set('autorId', autorId);
      formData.set('categoriasHabilitadas', JSON.stringify([...categorias]));
      if (modo === 'upload' && arquivo) formData.set('arquivo', arquivo);
      if (modo === 'paste') formData.set('textoColado', textoColado);

      const respostaCriar = await fetch('/api/documentos', { method: 'POST', body: formData });
      const corpoCriar = await respostaCriar.json();
      if (!respostaCriar.ok) throw new Error(corpoCriar.erro ?? 'Falha ao criar o documento.');

      const documentoId = corpoCriar.documento.id as string;
      const respostaTransicao = await fetch(`/api/documentos/${documentoId}/transicao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusNovo: 'em_checagem' }),
      });
      if (!respostaTransicao.ok) {
        const corpo = await respostaTransicao.json();
        throw new Error(corpo.erro ?? 'Documento criado, mas falhou ao iniciar a checagem.');
      }

      router.push(`/documentos/${documentoId}/checagem`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado.');
      setEnviando(false);
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
            Etapa 1 de 3
          </div>
          <h1 style={{ fontSize: 34, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Novo documento</h1>
          <p style={{ margin: '8px 0 0', fontSize: 14, maxWidth: '58ch', color: 'var(--color-muted)' }}>
            Envie a minuta para checagem de tom e comunicação contra os modelos aprovados do escritório.
          </p>
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', textAlign: 'right' }}>
          <div>
            Guia de estilo <span style={{ color: '#1C1B22', fontWeight: 500 }}>{versaoGuia ?? '—'}</span>
          </div>
          <div>{totalModelosAprovados} modelo(s) aprovado(s) na base</div>
        </div>
      </header>

      <div style={{ padding: '32px 40px 56px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 28, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
          <div className="field">
            <label htmlFor="titulo">Título da minuta</label>
            <input id="titulo" className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Parceiro credenciado — Onevo v3" />
          </div>

          <div style={{ display: 'flex', gap: 0, border: '1px solid var(--color-divider)', width: 'fit-content' }}>
            <button
              type="button"
              onClick={() => setModo('upload')}
              style={{
                padding: '9px 16px', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
                fontWeight: modo === 'upload' ? 600 : 400, background: modo === 'upload' ? '#102B4E' : '#FFFFFF',
                color: modo === 'upload' ? '#FFFFFF' : 'rgba(28,27,34,0.7)',
              }}
            >
              Upload de arquivo
            </button>
            <button
              type="button"
              onClick={() => setModo('paste')}
              style={{
                padding: '9px 16px', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
                fontWeight: modo === 'paste' ? 600 : 400, background: modo === 'paste' ? '#102B4E' : '#FFFFFF',
                color: modo === 'paste' ? '#FFFFFF' : 'rgba(28,27,34,0.7)',
              }}
            >
              Colar texto
            </button>
          </div>

          {modo === 'upload' ? (
            <>
              <div
                className="blueprint"
                onClick={() => inputArquivoRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const arquivoSolto = e.dataTransfer.files?.[0];
                  if (arquivoSolto) setArquivo(arquivoSolto);
                }}
                style={{
                  padding: '44px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
                  textAlign: 'center', background: '#FFFFFF', cursor: 'pointer',
                }}
              >
                <Corners />
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#102B4E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
                <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>Arraste a minuta para cá</div>
                <div style={{ fontSize: 13, color: 'rgba(28,27,34,0.6)' }}>.docx, .pdf ou .odt — até 20 MB</div>
                <button type="button" className="btn btn-primary" style={{ marginTop: 6 }}>
                  Selecionar arquivo
                </button>
                <input
                  ref={inputArquivoRef}
                  type="file"
                  accept=".docx,.pdf,.odt"
                  hidden
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                />
              </div>
              {arquivo ? (
                <div
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                    padding: '13px 16px', border: '1px solid var(--color-divider)', background: '#FFFFFF',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#102B4E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" /><path d="M14 2v5h6" /><path d="M8 13h8" /><path d="M8 17h8" />
                    </svg>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{arquivo.name}</div>
                      <div style={{ fontSize: 11, color: 'rgba(28,27,34,0.65)' }}>{(arquivo.size / 1024).toFixed(0)} KB</div>
                    </div>
                  </div>
                  <span className="tag tag-accent-2" style={{ flex: 'none' }}>
                    Pronto
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <div className="field">
              <label>Texto da minuta</label>
              <textarea
                className="input"
                rows={14}
                placeholder="Cole aqui o texto integral da minuta, incluindo numeração de cláusulas."
                style={{ minHeight: 320, fontSize: 13, lineHeight: 1.7, background: '#FFFFFF' }}
                value={textoColado}
                onChange={(e) => setTextoColado(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 11, color: 'rgba(28,27,34,0.65)' }}>
                <span>A numeração das cláusulas é usada para localizar os trechos sinalizados.</span>
                <span>{textoColado.length} caracteres</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          <div className="field">
            <label htmlFor="tipoPeca">Tipo de peça</label>
            <select id="tipoPeca" className="input" style={{ background: '#FFFFFF' }} value={tipoPecaId} onChange={(e) => setTipoPecaId(e.target.value)}>
              {[...gruposTipoPeca.entries()].map(([grupo, itens]) => (
                <optgroup key={grupo} label={grupo}>
                  {itens.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="cliente">Cliente relacionado</label>
            <select id="cliente" className="input" style={{ background: '#FFFFFF' }} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              {[...gruposClientes.entries()].map(([tipo, itens]) => (
                <optgroup key={tipo} label={ROTULO_GRUPO_CLIENTE[tipo as TipoCliente]}>
                  {itens.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="autor">Autor da minuta</label>
            <select
              id="autor"
              className="input"
              style={{ background: '#FFFFFF' }}
              value={autorId}
              onChange={(e) => setAutorId(e.target.value)}
              disabled={!podeEscolherAutor}
            >
              {podeEscolherAutor ? (
                autoresPossiveis.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome} — {u.perfil === 'advogado' ? 'advogado(a)' : 'estagiário(a)'}
                  </option>
                ))
              ) : (
                <option value={usuarioAtual.id}>{usuarioAtual.nome} (você)</option>
              )}
            </select>
            {!podeEscolherAutor ? (
              <div style={{ fontSize: 11, color: 'rgba(28,27,34,0.65)', marginTop: 6 }}>Estagiário só sobe minuta em nome de si mesmo.</div>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="socio">Sócio responsável pela revisão final</label>
            <select id="socio" className="input" style={{ background: '#FFFFFF' }} value={socioRevisorId} onChange={(e) => setSocioRevisorId(e.target.value)}>
              {socios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>

          <div style={{ padding: 16, border: '1px solid var(--color-divider)', background: '#FFFFFF' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A6A65', fontWeight: 600, marginBottom: 10 }}>
              Checagens aplicadas
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13 }}>
              {TODAS_AS_CATEGORIAS.map((cat) => (
                <label key={cat.valor} className="radio" style={{ gap: 10, alignItems: cat.descricao ? 'flex-start' : 'center' }}>
                  <input type="checkbox" checked={categorias.has(cat.valor)} onChange={() => alternarCategoria(cat.valor)} />
                  <span className="dot" style={{ borderRadius: 0, marginTop: cat.descricao ? 3 : 0 }} />
                  <span>
                    {cat.rotulo}
                    {cat.descricao ? (
                      <span style={{ display: 'block', fontSize: 11, color: 'rgba(28,27,34,0.65)', lineHeight: 1.5 }}>{cat.descricao}</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {erro ? <div style={{ fontSize: 13, color: '#93342B' }}>{erro}</div> : null}

          <button type="button" className="btn btn-primary btn-block" style={{ height: 46, fontSize: 15 }} onClick={enviarParaChecagem} disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar para checagem'}
          </button>
          <div style={{ fontSize: 11, color: 'rgba(28,27,34,0.65)', textAlign: 'center' }}>
            A minuta é comparada ao modelo aprovado mais próximo antes de seguir ao sócio.
          </div>
        </div>
      </div>
    </div>
  );
}
