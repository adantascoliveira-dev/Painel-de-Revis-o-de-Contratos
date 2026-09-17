import { extrairClausulas } from '@/lib/extracao/clausulas';
import { detectarConflitosEntreRegras } from '@/lib/rules/estilo/motor';
import type { Clausula, Documento, ModeloAprovado, RegraEstilo, Sinalizacao } from '@/types/database.types';

export type RazaoJulgamentoHumano = 'decisao_comercial' | 'contradicao_historico' | 'conflito_regras';

export interface PontoJulgamentoHumano {
  razao: RazaoJulgamentoHumano;
  clausula_numero: string | null;
  trecho: string;
  offset_inicio: number;
  offset_fim: number;
  sinalizacao_id: string | null;
  contexto: {
    descricao: string;
    o_que_o_modelo_diz?: string | null;
    o_que_contratos_anteriores_fizeram?: { valor: string; ocorrencias: number }[];
    regras_em_conflito?: { nome: string; orientacao: string }[];
  };
}

interface TermoComercial {
  padrao: RegExp;
  campoResumoClausula: string;
  rotulo: string;
}

// Termos que, quando aparecem numa cláusula, representam decisão comercial do
// sócio (teto de responsabilidade, foro, prazo) mesmo que nenhuma sinalização
// automática tenha sido gerada para eles.
const TERMOS_COMERCIAIS: TermoComercial[] = [
  { padrao: /foro\s+d[ae]\s+comarca[^.;]*[.;]?/i, campoResumoClausula: 'foro', rotulo: 'foro' },
  { padrao: /teto\s+de\s+responsabilidade[^.;]*[.;]?/i, campoResumoClausula: 'teto_responsabilidade', rotulo: 'teto de responsabilidade' },
  { padrao: /prazo\s+de\s+(?:vig[êe]ncia|sigilo|confidencialidade)[^.;]*[.;]?/i, campoResumoClausula: 'prazo_sigilo_meses', rotulo: 'prazo' },
];

function buscarClausulaCorrespondente(clausulas: Clausula[], numero: string | null): Clausula | null {
  if (!numero) return null;
  return clausulas.find((c) => c.numero === numero) ?? null;
}

function agregarValoresAnteriores(
  contratos: { resumo_clausulas: Record<string, unknown> }[],
  campo: string
): { valor: string; ocorrencias: number }[] {
  const contagem = new Map<string, number>();
  for (const contrato of contratos) {
    const valor = contrato.resumo_clausulas[campo];
    if (valor === undefined || valor === null) continue;
    const chave = String(valor);
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .map(([valor, ocorrencias]) => ({ valor, ocorrencias }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias);
}

function estaDentroDeAlgumIntervalo(offset: number, intervalos: { offset_inicio: number; offset_fim: number }[]): boolean {
  return intervalos.some((i) => offset >= i.offset_inicio && offset < i.offset_fim);
}

/**
 * Deriva os pontos que exigem julgamento humano na revisão final (Tela 3):
 * decisão comercial (teto de responsabilidade, foro, prazo), contradição entre
 * o histórico do cliente e o modelo aprovado, e conflito entre regras do guia.
 * Cada ponto carrega o contexto que fundamenta a decisão do sócio.
 */
export function derivarPontosDeJulgamentoHumano(params: {
  documento: Documento;
  sinalizacoesPendentes: Sinalizacao[];
  modeloAprovado: ModeloAprovado | null;
  contratosAnteriores: { resumo_clausulas: Record<string, unknown> }[];
  regrasEstiloAtivas: RegraEstilo[];
}): PontoJulgamentoHumano[] {
  const { documento, sinalizacoesPendentes, modeloAprovado, contratosAnteriores, regrasEstiloAtivas } = params;
  const pontos: PontoJulgamentoHumano[] = [];

  // 1) Toda sinalização de contexto de negócio pendente é, por natureza, uma
  // contradição entre o histórico/cadastro do cliente e o texto padrão.
  for (const sinalizacao of sinalizacoesPendentes.filter((s) => s.natureza === 'contexto_negocio')) {
    pontos.push({
      razao: 'contradicao_historico',
      clausula_numero: sinalizacao.clausula_numero,
      trecho: sinalizacao.trecho_original,
      offset_inicio: sinalizacao.offset_inicio,
      offset_fim: sinalizacao.offset_fim,
      sinalizacao_id: sinalizacao.id,
      contexto: { descricao: sinalizacao.justificativa },
    });
  }

  // 2) Decisão comercial: escaneia o texto por teto de responsabilidade, foro
  // e prazo, mesmo quando nenhuma sinalização automática cobriu o trecho.
  const clausulasMinuta = extrairClausulas(documento.texto_trabalho);
  const clausulasModelo = modeloAprovado ? modeloAprovado.clausulas : [];
  const intervalosJaCobertos = pontos.map((p) => ({ offset_inicio: p.offset_inicio, offset_fim: p.offset_fim }));

  for (const clausula of clausulasMinuta) {
    for (const termo of TERMOS_COMERCIAIS) {
      const match = termo.padrao.exec(clausula.texto);
      if (!match) continue;
      const offsetInicio = clausula.offset_inicio + match.index;
      const offsetFim = offsetInicio + match[0].length;
      if (estaDentroDeAlgumIntervalo(offsetInicio, intervalosJaCobertos)) continue;

      const clausulaModelo = buscarClausulaCorrespondente(clausulasModelo, clausula.numero);
      pontos.push({
        razao: 'decisao_comercial',
        clausula_numero: clausula.numero,
        trecho: match[0],
        offset_inicio: offsetInicio,
        offset_fim: offsetFim,
        sinalizacao_id: null,
        contexto: {
          descricao: `Cláusula de ${termo.rotulo}: decisão comercial que cabe ao sócio confirmar.`,
          o_que_o_modelo_diz: clausulaModelo?.texto ?? null,
          o_que_contratos_anteriores_fizeram: agregarValoresAnteriores(contratosAnteriores, termo.campoResumoClausula),
        },
      });
    }
  }

  // 3) Conflito entre regras do guia no mesmo trecho.
  for (const [a, b] of detectarConflitosEntreRegras(documento.texto_trabalho, regrasEstiloAtivas)) {
    pontos.push({
      razao: 'conflito_regras',
      clausula_numero: null,
      trecho: a.trecho_original,
      offset_inicio: Math.min(a.offset_inicio, b.offset_inicio),
      offset_fim: Math.max(a.offset_fim, b.offset_fim),
      sinalizacao_id: null,
      contexto: {
        descricao: 'Duas regras do guia de estilo dão orientações diferentes para o mesmo trecho.',
        regras_em_conflito: [
          { nome: a.justificativa, orientacao: a.sugestao_ajuste },
          { nome: b.justificativa, orientacao: b.sugestao_ajuste },
        ],
      },
    });
  }

  return pontos.sort((a, b) => a.offset_inicio - b.offset_inicio);
}
