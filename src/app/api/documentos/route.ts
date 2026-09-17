import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { extrairTextoDeArquivo, TAMANHO_MAXIMO_BYTES } from '@/lib/extracao/texto';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { criarClienteServidor } from '@/lib/supabase/server';
import { criarDocumento, listarDocumentos } from '@/lib/services/documentos';
import type { CategoriaSinalizacao } from '@/types/database.types';

export async function GET(request: Request) {
  try {
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const { searchParams } = new URL(request.url);
    const documentos = await listarDocumentos(supabase, {
      status: searchParams.get('status') ?? undefined,
      clienteId: searchParams.get('clienteId') ?? undefined,
    });
    return NextResponse.json({ documentos });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}

/**
 * Tela 1 — Novo documento. Aceita multipart/form-data com um arquivo
 * (.docx/.pdf/.odt) OU o campo "textoColado" com texto puro colado pelo usuário.
 */
export async function POST(request: Request) {
  try {
    const supabase = await criarClienteServidor();
    const usuario = await exigirUsuarioAtual(supabase);

    const formData = await request.formData();
    const titulo = String(formData.get('titulo') ?? '');
    const tipoPecaId = String(formData.get('tipoPecaId') ?? '');
    const clienteId = String(formData.get('clienteId') ?? '');
    const socioRevisorId = String(formData.get('socioRevisorId') ?? '');
    // Advogado/sócio pode atribuir a autoria a outra pessoa (upload administrativo);
    // estagiário não manda autorId — a RLS de documentos trava autor_id = si mesmo
    // para quem tem perfil estagiario, então o "?? usuario.id" abaixo é só o caso comum
    // (autoatribuição), a regra de verdade está na política de INSERT do banco.
    const autorIdInformado = formData.get('autorId');
    const autorId = typeof autorIdInformado === 'string' && autorIdInformado ? autorIdInformado : usuario.id;
    const categoriasHabilitadas = JSON.parse(
      String(formData.get('categoriasHabilitadas') ?? '[]')
    ) as CategoriaSinalizacao[];
    const arquivo = formData.get('arquivo');
    const textoColado = formData.get('textoColado');

    if (!titulo || !tipoPecaId || !clienteId || !socioRevisorId) {
      return NextResponse.json({ erro: 'titulo, tipoPecaId, clienteId e socioRevisorId são obrigatórios.' }, { status: 400 });
    }

    let texto: string;
    let arquivoOriginal: { path: string; nome: string; mime: string; tamanhoBytes: number } | undefined;

    if (arquivo instanceof File) {
      if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
        return NextResponse.json({ erro: 'Arquivo maior que 20 MB.' }, { status: 422 });
      }
      const buffer = Buffer.from(await arquivo.arrayBuffer());
      const extraido = await extrairTextoDeArquivo(buffer, arquivo.type);
      texto = extraido.texto;

      // Upload feito com a service role: o bucket é privado e nunca é acessado
      // direto pelo cliente (ver comentário na migração de storage).
      const documentoId = randomUUID();
      const path = `${documentoId}/${arquivo.name}`;
      const admin = criarClienteAdmin();
      const { error: erroUpload } = await admin.storage.from('minutas-originais').upload(path, buffer, {
        contentType: arquivo.type,
      });
      if (erroUpload) throw erroUpload;

      arquivoOriginal = { path, nome: arquivo.name, mime: arquivo.type, tamanhoBytes: arquivo.size };
    } else if (typeof textoColado === 'string' && textoColado.trim()) {
      texto = textoColado;
    } else {
      return NextResponse.json({ erro: 'Envie um arquivo (.docx/.pdf/.odt) ou o texto colado.' }, { status: 400 });
    }

    const resultado = await criarDocumento(supabase, {
      titulo,
      texto,
      tipoPecaId,
      clienteId,
      autorId,
      socioRevisorId,
      categoriasHabilitadas,
      arquivoOriginal,
    });

    return NextResponse.json(resultado, { status: 201 });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
