import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';
import type { ModeloAprovado } from '@/types/database.types';

export async function GET(request: Request) {
  try {
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);

    const { searchParams } = new URL(request.url);
    let query = supabase.from('modelos_aprovados').select('*').eq('ativo', true).order('aprovado_em', { ascending: false });
    const tipoPecaId = searchParams.get('tipoPecaId');
    if (tipoPecaId) query = query.eq('tipo_peca_id', tipoPecaId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ modelos: data as ModeloAprovado[] });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
