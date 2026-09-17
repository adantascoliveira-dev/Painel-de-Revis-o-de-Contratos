import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import type { Cliente, Documento, StatusDocumento, TipoPeca, Usuario } from '@/types/database.types';

const ROTULO_STATUS: Record<StatusDocumento, { rotulo: string; tag: 'accent' | 'accent-2' | 'neutral' }> = {
  rascunho: { rotulo: 'Rascunho', tag: 'neutral' },
  em_checagem: { rotulo: 'Em checagem', tag: 'accent' },
  aguardando_socio: { rotulo: 'Aguardando sócio', tag: 'accent-2' },
  em_ajuste_pela_equipe: { rotulo: 'Em ajuste pela equipe', tag: 'accent-2' },
  aprovado: { rotulo: 'Aprovado', tag: 'neutral' },
};

function linkParaDocumento(doc: Documento): string {
  if (doc.status === 'rascunho' || doc.status === 'em_checagem' || doc.status === 'em_ajuste_pela_equipe') {
    return `/documentos/${doc.id}/checagem`;
  }
  return `/documentos/${doc.id}/revisao`;
}

export default async function ListaDocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await criarClienteServidor();

  let query = supabase.from('documentos').select('*').order('atualizado_em', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data: documentos } = await query;
  const docs = (documentos ?? []) as Documento[];

  const idsClientes = [...new Set(docs.map((d) => d.cliente_id))];
  const idsTipos = [...new Set(docs.map((d) => d.tipo_peca_id))];
  const idsUsuarios = [...new Set(docs.flatMap((d) => [d.autor_id, d.socio_revisor_id]))];

  const [{ data: clientes }, { data: tipos }, { data: usuarios }] = await Promise.all([
    idsClientes.length ? supabase.from('clientes').select('id, nome').in('id', idsClientes) : Promise.resolve({ data: [] }),
    idsTipos.length ? supabase.from('tipos_peca').select('id, nome').in('id', idsTipos) : Promise.resolve({ data: [] }),
    idsUsuarios.length ? supabase.from('usuarios').select('id, nome').in('id', idsUsuarios) : Promise.resolve({ data: [] }),
  ]);

  const mapaClientes = new Map((clientes as Pick<Cliente, 'id' | 'nome'>[] | null ?? []).map((c) => [c.id, c.nome]));
  const mapaTipos = new Map((tipos as Pick<TipoPeca, 'id' | 'nome'>[] | null ?? []).map((t) => [t.id, t.nome]));
  const mapaUsuarios = new Map((usuarios as Pick<Usuario, 'id' | 'nome'>[] | null ?? []).map((u) => [u.id, u.nome]));

  return (
    <div>
      <header style={{ padding: '34px 40px 26px', borderBottom: '1px solid var(--color-divider)' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A6A65', fontWeight: 600, marginBottom: 8 }}>
          Minutas do escritório
        </div>
        <h1 style={{ fontSize: 34, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Documentos</h1>
        <p style={{ marginTop: 8, fontSize: 14, color: 'var(--color-muted)' }}>
          {status ? `Filtrado por status: ${ROTULO_STATUS[status as StatusDocumento]?.rotulo ?? status}` : 'Todas as minutas que você pode ver.'}
        </p>
      </header>

      <div style={{ padding: '24px 40px 40px' }}>
        {docs.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>Nenhum documento por aqui ainda.</p>
        ) : (
          <div style={{ border: '1px solid var(--color-divider)', background: '#FFFFFF', overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 16 }}>Título</th>
                  <th>Cliente</th>
                  <th>Tipo de peça</th>
                  <th>Autor</th>
                  <th>Sócio revisor</th>
                  <th style={{ paddingRight: 16 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id}>
                    <td style={{ paddingLeft: 16 }}>
                      <Link href={linkParaDocumento(doc)} style={{ fontWeight: 500, color: 'var(--color-text)' }}>
                        {doc.titulo}
                      </Link>
                    </td>
                    <td>{mapaClientes.get(doc.cliente_id) ?? '—'}</td>
                    <td>{mapaTipos.get(doc.tipo_peca_id) ?? '—'}</td>
                    <td>{mapaUsuarios.get(doc.autor_id) ?? '—'}</td>
                    <td>{mapaUsuarios.get(doc.socio_revisor_id) ?? '—'}</td>
                    <td style={{ paddingRight: 16 }}>
                      <span className={`tag tag-${ROTULO_STATUS[doc.status].tag}`}>{ROTULO_STATUS[doc.status].rotulo}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
