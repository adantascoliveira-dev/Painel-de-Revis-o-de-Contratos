import type { SupabaseClient } from '@supabase/supabase-js';
import type { Documento, FichaConhecimento, FonteInferenciaContexto, SeveridadeSinalizacao } from '@/types/database.types';
import { localizarTrecho } from './ancoragem';
import type { SaidaAnalise } from './esquema';
import { criarChamadorAnthropic, type ChamadorModelo, type UsoDoModelo } from './modelo';
import { montarMensagemDaMinuta, montarSystemPrompt } from './prompt';
import { buscarFichasCandidatas, selecionarFichas, totalDeFichas, type FichasSelecionadas } from './selecao';

export interface CandidatoSinalizacaoFicha {
  clausula_numero: string | null;
  trecho_original: string;
  offset_inicio: number;
  offset_fim: number;
  categoria: 'caso_cliente_generico';
  natureza: 'contexto_negocio';
  sugestao_ajuste: string;
  justificativa: string;
  severidade: SeveridadeSinalizacao;
  fonte_inferencia: FonteInferenciaContexto;
}

export interface ResultadoAnaliseFichas {
  status: 'desativada' | 'sem_ficha' | 'concluida' | 'recusada' | 'erro';
  semFichaPorTipo: boolean;
  fichasAplicadas: string[];
  apontamentosGerados: number;
  apontamentosDescartados: number;
  motivo?: string;
  uso?: UsoDoModelo;
}

/**
 * Transforma a resposta do modelo em sinalizações graváveis. O modelo só pode apontar o
 * que existe na minuta: apontamento cujo trecho não é localizado no texto é descartado.
 * Tudo entra como contexto do negócio (nunca como "estilo"), de propósito: o "aplicar
 * em lote" só atua sobre estilo, e texto sugerido por IA não deve ser aplicado sem revisão.
 */
export function converterApontamentos(
  saida: SaidaAnalise,
  texto: string,
  fichas: FichaConhecimento[]
): { candidatos: CandidatoSinalizacaoFicha[]; descartados: number } {
  const idPorTitulo = new Map(fichas.map((f) => [f.titulo.trim().toLowerCase(), f.id]));
  const candidatos: CandidatoSinalizacaoFicha[] = [];
  const vistos = new Set<string>();
  let descartados = 0;

  for (const ap of saida.apontamentos) {
    const detalhe = `${ap.origem_ficha.trim()}, ${ap.origem_item.trim()}`;
    let inicio: number;
    let fim: number;
    let trechoOriginal: string;

    if (ap.acao === 'inserir') {
      const ancora = localizarTrecho(texto, ap.trecho);
      inicio = fim = ancora ? ancora.fim : texto.length;
      trechoOriginal = '';
    } else {
      const local = localizarTrecho(texto, ap.trecho);
      if (!local) {
        descartados++;
        continue;
      }
      inicio = local.inicio;
      fim = local.fim;
      trechoOriginal = texto.slice(local.inicio, local.fim);
    }

    const duplicidade = `${inicio}|${fim}|${ap.acao}|${ap.origem_item}|${ap.sugestao}`;
    if (vistos.has(duplicidade)) continue;
    vistos.add(duplicidade);

    candidatos.push({
      clausula_numero: ap.clausula_numero,
      trecho_original: trechoOriginal,
      offset_inicio: inicio,
      offset_fim: fim,
      categoria: 'caso_cliente_generico',
      natureza: 'contexto_negocio',
      sugestao_ajuste: ap.sugestao.trim(),
      justificativa: `${ap.justificativa.trim()} Origem: ${detalhe}.`,
      severidade: ap.severidade,
      fonte_inferencia: {
        tipo: 'ficha',
        referencia_id: idPorTitulo.get(ap.origem_ficha.trim().toLowerCase()),
        detalhe,
        acao: ap.acao,
        categoria_ficha: ap.categoria_ficha,
      },
    });
  }

  return { candidatos, descartados };
}

function tituloDasFichas(selecionadas: FichasSelecionadas): string[] {
  return [
    ...(selecionadas.tipo ? [selecionadas.tipo.titulo] : []),
    ...selecionadas.cliente.map((f) => f.titulo),
    ...selecionadas.transversais.map((f) => f.titulo),
  ];
}

async function substituirApontamentosDeFicha(adminClient: SupabaseClient, documentoId: string, candidatos: CandidatoSinalizacaoFicha[]) {
  const { error: erroDelete } = await adminClient
    .from('sinalizacoes')
    .delete()
    .eq('documento_id', documentoId)
    .eq('natureza', 'contexto_negocio')
    .eq('resolucao', 'pendente')
    .eq('fonte_inferencia->>tipo', 'ficha');
  if (erroDelete) throw erroDelete;

  if (candidatos.length === 0) return;
  const { error: erroInsert } = await adminClient
    .from('sinalizacoes')
    .insert(candidatos.map((c) => ({ ...c, documento_id: documentoId })));
  if (erroInsert) throw erroInsert;
}

/**
 * Análise assíncrona da minuta contra a base de conhecimento (fichas validadas).
 * Chame só depois dos apontamentos de heurística do job, que apagam os pendentes de
 * contexto de negócio antes de inserir os seus. Nunca lança: falha da IA vira status
 * "erro" e o job segue com o que as heurísticas já geraram.
 */
export async function analisarMinutaComFichas(
  adminClient: SupabaseClient,
  documento: Documento,
  contexto: { nomeCliente: string; nomeTipoPeca: string },
  chamadorInjetado?: ChamadorModelo
): Promise<ResultadoAnaliseFichas> {
  const chamador = chamadorInjetado ?? criarChamadorAnthropic();
  if (!chamador) {
    return { status: 'desativada', semFichaPorTipo: false, fichasAplicadas: [], apontamentosGerados: 0, apontamentosDescartados: 0, motivo: 'ANTHROPIC_API_KEY não configurada.' };
  }

  try {
    const candidatas = await buscarFichasCandidatas(adminClient, documento);
    const selecionadas = selecionarFichas(candidatas, documento);
    const semFichaPorTipo = selecionadas.tipo === null;

    if (totalDeFichas(selecionadas) === 0) {
      await substituirApontamentosDeFicha(adminClient, documento.id, []);
      return { status: 'sem_ficha', semFichaPorTipo: true, fichasAplicadas: [], apontamentosGerados: 0, apontamentosDescartados: 0 };
    }

    const resposta = await chamador({
      system: montarSystemPrompt(selecionadas),
      mensagemUsuario: montarMensagemDaMinuta({
        titulo: documento.titulo,
        tipoPeca: contexto.nomeTipoPeca,
        subtipo: documento.subtipo,
        polo: documento.polo,
        cliente: contexto.nomeCliente,
        texto: documento.texto_trabalho,
      }),
    });

    const fichasAplicadas = tituloDasFichas(selecionadas);

    if (resposta.recusou) {
      return { status: 'recusada', semFichaPorTipo, fichasAplicadas, apontamentosGerados: 0, apontamentosDescartados: 0, motivo: 'O modelo recusou a análise.', uso: resposta.uso };
    }
    if (!resposta.saida) {
      return {
        status: 'erro', semFichaPorTipo, fichasAplicadas, apontamentosGerados: 0, apontamentosDescartados: 0,
        motivo: resposta.truncou ? 'Resposta do modelo truncada (minuta muito longa).' : 'Resposta do modelo fora do formato esperado.',
        uso: resposta.uso,
      };
    }

    const todasAsFichas = [selecionadas.tipo, ...selecionadas.cliente, ...selecionadas.transversais].filter((f): f is FichaConhecimento => f !== null);
    const { candidatos, descartados } = converterApontamentos(resposta.saida, documento.texto_trabalho, todasAsFichas);
    await substituirApontamentosDeFicha(adminClient, documento.id, candidatos);

    return { status: 'concluida', semFichaPorTipo, fichasAplicadas, apontamentosGerados: candidatos.length, apontamentosDescartados: descartados, uso: resposta.uso };
  } catch (erro) {
    console.error('Falha na análise por ficha:', erro);
    return {
      status: 'erro', semFichaPorTipo: false, fichasAplicadas: [], apontamentosGerados: 0, apontamentosDescartados: 0,
      motivo: erro instanceof Error ? erro.message : String(erro),
    };
  }
}

/** Texto curto para a notificação ao autor. */
export function resumirParaNotificacao(resultado: ResultadoAnaliseFichas): string {
  switch (resultado.status) {
    case 'desativada':
      return '';
    case 'sem_ficha':
      return ' Análise por ficha: sem ficha validada para este tipo de peça, subtipo e polo.';
    case 'concluida': {
      const aviso = resultado.semFichaPorTipo ? ' Sem ficha por tipo validada; usadas só fichas de cliente e alertas transversais.' : '';
      return ` Análise por ficha: ${resultado.apontamentosGerados} ponto(s).${aviso}`;
    }
    case 'recusada':
    case 'erro':
      return ' Análise por ficha indisponível desta vez.';
  }
}
