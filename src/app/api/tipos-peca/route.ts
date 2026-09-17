import { NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/api/erros';
import { exigirUsuarioAtual } from '@/lib/auth/usuario-atual';
import { criarClienteServidor } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await criarClienteServidor();
    await exigirUsuarioAtual(supabase);
    const { data, error } = await supabase.from('tipos_peca').select('*').eq('ativo', true).order('nome');
    if (error) throw error;
    return NextResponse.json({ tiposPeca: data });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
