import { z } from 'zod';

export const ApontamentoFichaSchema = z.object({
  clausula_numero: z.string().nullable(),
  acao: z.enum(['substituir', 'inserir', 'informativo']),
  trecho: z.string(),
  sugestao: z.string(),
  justificativa: z.string(),
  severidade: z.enum(['baixa', 'media', 'alta']),
  origem_ficha: z.string(),
  origem_item: z.string(),
  categoria_ficha: z.enum(['posicao', 'obrigatoria_ausente', 'proibida', 'alerta', 'limite', 'outro']),
});

export const SaidaAnaliseSchema = z.object({
  apontamentos: z.array(ApontamentoFichaSchema),
});

export type ApontamentoFicha = z.infer<typeof ApontamentoFichaSchema>;
export type SaidaAnalise = z.infer<typeof SaidaAnaliseSchema>;
