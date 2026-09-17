import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import type { Cliente } from '@/types/database.types';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const [{ data: cliente, error }, { data: contratosAnteriores }] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', id).single(),
      supabase.from('cliente_contratos_anteriores').select('*').eq('cliente_id', id).order('data_documento', { ascending: false }),
    ]);
    if (error) throw error;

    return NextResponse.json({ cliente: cliente as Cliente, contratosAnteriores });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const body = (await request.json()) as Partial<Cliente>;
    const { data, error } = await supabase.from('clientes').update(body).eq('id', id).select('*').single();
    if (error) throw error;
    return NextResponse.json({ cliente: data as Cliente });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
