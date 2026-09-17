import type { CSSProperties } from 'react';
import type { CategoriaSinalizacao } from '@/types/database.types';

export interface MetaCategoria {
  rotulo: string;
  ink: string;
  bg: string;
  linha: string;
}

export const METADADOS_CATEGORIA: Record<CategoriaSinalizacao, MetaCategoria> = {
  juridiques_excesso: { rotulo: 'Juridiquês', ink: 'var(--cat-juridiques-ink)', bg: 'var(--cat-juridiques-bg)', linha: 'var(--cat-juridiques-line)' },
  tom_culpa: { rotulo: 'Tom', ink: 'var(--cat-tom-ink)', bg: 'var(--cat-tom-bg)', linha: 'var(--cat-tom-line)' },
  formalismo_fora_padrao: { rotulo: 'Formalismo', ink: 'var(--cat-formalismo-ink)', bg: 'var(--cat-formalismo-bg)', linha: 'var(--cat-formalismo-line)' },
  ruido_informacao_desnecessaria: { rotulo: 'Ruído', ink: 'var(--cat-ruido-ink)', bg: 'var(--cat-ruido-bg)', linha: 'var(--cat-ruido-line)' },
  caso_cliente_generico: { rotulo: 'Contexto', ink: 'var(--cat-contexto-ink)', bg: 'var(--cat-contexto-bg)', linha: 'var(--cat-contexto-line)' },
  clausulas_ausentes: { rotulo: 'Cláusula ausente', ink: 'var(--cat-clausulas-ausentes-ink)', bg: 'var(--cat-clausulas-ausentes-bg)', linha: 'var(--cat-clausulas-ausentes-line)' },
};

export const CATEGORIAS_ESTILO: CategoriaSinalizacao[] = [
  'juridiques_excesso',
  'tom_culpa',
  'formalismo_fora_padrao',
  'ruido_informacao_desnecessaria',
  'clausulas_ausentes',
];

export const TODAS_AS_CATEGORIAS: { valor: CategoriaSinalizacao; rotulo: string; descricao?: string; marcadaPorPadrao: boolean }[] = [
  { valor: 'juridiques_excesso', rotulo: 'Juridiquês em excesso', marcadaPorPadrao: true },
  { valor: 'tom_culpa', rotulo: 'Tom que aponta responsáveis', marcadaPorPadrao: true },
  { valor: 'formalismo_fora_padrao', rotulo: 'Formalismo fora do padrão', marcadaPorPadrao: true },
  { valor: 'ruido_informacao_desnecessaria', rotulo: 'Ruído e informação desnecessária', marcadaPorPadrao: true },
  {
    valor: 'caso_cliente_generico',
    rotulo: 'Contexto do negócio do cliente',
    descricao: 'operação, estrutura societária e histórico contratual',
    marcadaPorPadrao: true,
  },
  { valor: 'clausulas_ausentes', rotulo: 'Cláusulas ausentes no modelo', marcadaPorPadrao: false },
];

export function tagStyleCategoria(categoria: CategoriaSinalizacao): CSSProperties {
  const meta = METADADOS_CATEGORIA[categoria];
  return { background: meta.bg, color: meta.ink };
}
