import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import type { Cliente } from '@/types/database.types';

export async function GET() {
  try {
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);
    const { data, error } = await supabase.from('clientes').select('*').eq('ativo', true).order('nome');
    if (error) throw error;
    return NextResponse.json({ clientes: data as Cliente[] });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}

/** Cadastro/edição de cliente é restrito a advogado/sócio via RLS (estagiário só lê). */
export async function POST(request: Request) {
  try {
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const body = (await request.json()) as Partial<Cliente>;
    const { data, error } = await supabase.from('clientes').insert(body).select('*').single();
    if (error) throw error;
    return NextResponse.json({ cliente: data as Cliente }, { status: 201 });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
