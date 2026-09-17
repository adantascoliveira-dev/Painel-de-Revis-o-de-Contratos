import { NextResponse } from 'next/server';
import { ArquivoInvalidoError } from '@/lib/extracao/texto';
import { NaoAutenticadoError } from '@/lib/auth/usuario-atual';

interface ErroPostgrest {
  message: string;
  code?: string;
}

function ehErroPostgrest(erro: unknown): erro is ErroPostgrest {
  return typeof erro === 'object' && erro !== null && 'message' in erro;
}

/**
 * Converte exceções da camada de serviço (RPC do Postgres, validação de
 * upload, autenticação) numa resposta HTTP com o status certo, sem vazar
 * detalhes internos além da mensagem que a própria regra de negócio já expõe
 * de propósito (as funções SECURITY DEFINER lançam RAISE EXCEPTION com texto
 * pensado para o usuário final).
 */
export function respostaDeErro(erro: unknown): NextResponse {
  if (erro instanceof NaoAutenticadoError) {
    return NextResponse.json({ erro: erro.message }, { status: 401 });
  }
  if (erro instanceof ArquivoInvalidoError) {
    return NextResponse.json({ erro: erro.message }, { status: 422 });
  }
  if (ehErroPostgrest(erro)) {
    const permissao = /permiss[ãa]o|só o s[óo]cio|s[óo] um s[óo]cio|deve apontar|deve ter perfil|row-level security/i.test(
      erro.message
    );
    return NextResponse.json({ erro: erro.message }, { status: permissao ? 403 : 400 });
  }
  console.error(erro);
  return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
}
