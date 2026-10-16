import type { SupabaseClient } from '@supabase/supabase-js';
import type { Documento, FichaConhecimento } from '@/types/database.types';
import { normalizarRotulo } from './secoes';

export interface FichasSelecionadas {
  tipo: FichaConhecimento | null;
  cliente: FichaConhecimento[];
  transversais: FichaConhecimento[];
}

type AlvoDaMinuta = Pick<Documento, 'tipo_peca_id' | 'cliente_id' | 'subtipo' | 'polo'>;

function chave(valor: string | null | undefined): string {
  return valor ? normalizarRotulo(valor) : '';
}

function ehUsavel(ficha: FichaConhecimento): boolean {
  return ficha.ativa && ficha.validada_em !== null;
}

/**
 * Aplica as camadas da base de conhecimento a uma minuta. A ficha por tipo exige
 * tipo de peça + subtipo + polo iguais aos da minuta (sem aproximação: se não há
 * ficha para aquele polo, o painel informa "sem ficha validada" em vez de inventar
 * posição). A de cliente vale para o cliente (opcionalmente restrita a tipo/subtipo/polo)
 * e prevalece sobre a ficha por tipo. Alertas transversais valem para todo o tipo de peça.
 */
export function selecionarFichas(fichas: FichaConhecimento[], alvo: AlvoDaMinuta): FichasSelecionadas {
  const usaveis = fichas.filter(ehUsavel);

  const tipo =
    usaveis.find(
      (f) =>
        f.escopo === 'tipo' &&
        f.tipo_peca_id === alvo.tipo_peca_id &&
        chave(f.subtipo) === chave(alvo.subtipo) &&
        chave(f.polo) === chave(alvo.polo)
    ) ?? null;

  const cliente = usaveis
    .filter(
      (f) =>
        f.escopo === 'cliente' &&
        f.cliente_id === alvo.cliente_id &&
        (f.tipo_peca_id === null || f.tipo_peca_id === alvo.tipo_peca_id) &&
        (!f.subtipo || chave(f.subtipo) === chave(alvo.subtipo)) &&
        (!f.polo || chave(f.polo) === chave(alvo.polo))
    )
    .sort((a, b) => pontosDeEspecificidade(b) - pontosDeEspecificidade(a));

  const transversais = usaveis.filter(
    (f) => f.escopo === 'transversal' && f.tipo_peca_id === alvo.tipo_peca_id && (!f.subtipo || chave(f.subtipo) === chave(alvo.subtipo))
  );

  return { tipo, cliente, transversais };
}

function pontosDeEspecificidade(ficha: FichaConhecimento): number {
  return (ficha.tipo_peca_id ? 1 : 0) + (ficha.subtipo ? 1 : 0) + (ficha.polo ? 1 : 0);
}

export function totalDeFichas(selecionadas: FichasSelecionadas): number {
  return (selecionadas.tipo ? 1 : 0) + selecionadas.cliente.length + selecionadas.transversais.length;
}

/** Só as fichas que podem se aplicar (do tipo de peça ou do cliente): o filtro fino é feito em selecionarFichas. */
export async function buscarFichasCandidatas(
  adminClient: SupabaseClient,
  alvo: Pick<Documento, 'tipo_peca_id' | 'cliente_id'>
): Promise<FichaConhecimento[]> {
  const { data, error } = await adminClient
    .from('fichas_conhecimento')
    .select('*')
    .eq('ativa', true)
    .not('validada_em', 'is', null)
    .or(`tipo_peca_id.eq.${alvo.tipo_peca_id},cliente_id.eq.${alvo.cliente_id}`);
  if (error) throw error;
  return data as FichaConhecimento[];
}
