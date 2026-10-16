import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { SaidaAnaliseSchema, type SaidaAnalise } from './esquema';

export interface UsoDoModelo {
  modelo: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export interface RespostaDoModelo {
  saida: SaidaAnalise | null;
  recusou: boolean;
  truncou: boolean;
  uso?: UsoDoModelo;
}

export type ChamadorModelo = (args: { system: string; mensagemUsuario: string }) => Promise<RespostaDoModelo>;

const MODELO_PADRAO = 'claude-opus-5-5';

/** null quando não há ANTHROPIC_API_KEY: a análise por ficha fica desligada, o resto do painel segue igual. */
export function criarChamadorAnthropic(): ChamadorModelo | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const modelo = process.env.ANTHROPIC_MODEL_FICHAS || MODELO_PADRAO;
  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: Number(process.env.ANTHROPIC_TIMEOUT_MS) || 200_000 });

  return async ({ system, mensagemUsuario }) => {
    const resposta = await client.messages.parse({
      model: modelo,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: mensagemUsuario }],
      output_config: { effort: 'medium', format: zodOutputFormat(SaidaAnaliseSchema) },
    });

    return {
      saida: resposta.parsed_output ?? null,
      recusou: resposta.stop_reason === 'refusal',
      truncou: resposta.stop_reason === 'max_tokens',
      uso: {
        modelo,
        inputTokens: resposta.usage.input_tokens,
        outputTokens: resposta.usage.output_tokens,
        cacheReadTokens: resposta.usage.cache_read_input_tokens ?? 0,
        cacheCreationTokens: resposta.usage.cache_creation_input_tokens ?? 0,
      },
    };
  };
}
