import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import { buscarDocumento } from '@/lib/services/documentos';
import { gerarDocxDocumento, gerarPdfDocumento } from '@/lib/services/exportacao';
import type { Cliente, TipoPeca } from '@/types/database.types';

function nomeArquivo(titulo: string, extensao: string): string {
  const slug = titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${slug || 'minuta'}.${extensao}`;
}

/** Baixa o texto de trabalho atual do documento em .docx ou .pdf (?formato=docx|pdf). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const documento = await buscarDocumento(supabase, id);
    if (!documento) return NextResponse.json({ erro: 'Documento não encontrado.' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const formato = searchParams.get('formato');
    if (formato !== 'docx' && formato !== 'pdf') {
      return NextResponse.json({ erro: 'formato deve ser "docx" ou "pdf".' }, { status: 400 });
    }

    const [{ data: cliente }, { data: tipoPeca }] = await Promise.all([
      supabase.from('clientes').select('nome').eq('id', documento.cliente_id).single(),
      supabase.from('tipos_peca').select('nome').eq('id', documento.tipo_peca_id).single(),
    ]);

    const statusRotulo = documento.status === 'aprovado' ? 'Aprovado' : 'Versão de trabalho — não aprovada';
    const subtitulo = `${(tipoPeca as Pick<TipoPeca, 'nome'> | null)?.nome ?? ''} · ${(cliente as Pick<Cliente, 'nome'> | null)?.nome ?? ''} · v${documento.versao} · ${statusRotulo}`;

    if (formato === 'docx') {
      const buffer = await gerarDocxDocumento({ titulo: documento.titulo, subtitulo, texto: documento.texto_trabalho });
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${nomeArquivo(documento.titulo, 'docx')}"`,
        },
      });
    }

    const buffer = await gerarPdfDocumento({ titulo: documento.titulo, subtitulo, texto: documento.texto_trabalho });
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nomeArquivo(documento.titulo, 'pdf')}"`,
      },
    });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
