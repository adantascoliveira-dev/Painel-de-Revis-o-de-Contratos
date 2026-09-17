import { extrairClausulas } from '@/lib/extracao/clausulas';
import type { Cliente, ClienteContratoAnterior, FonteInferenciaContexto } from '@/types/database.types';

export interface CandidatoSinalizacaoContexto {
  clausula_numero: string | null;
  trecho_original: string;
  offset_inicio: number;
  offset_fim: number;
  categoria: 'caso_cliente_generico';
  natureza: 'contexto_negocio';
  sugestao_ajuste: string;
  justificativa: string;
  severidade: 'baixa' | 'media' | 'alta';
  fonte_inferencia: FonteInferenciaContexto;
}

interface ContextoCliente {
  cliente: Cliente;
  contratosAnteriores: ClienteContratoAnterior[];
}

type Heuristica = (clausula: { numero: string | null; texto: string; offset_inicio: number }, ctx: ContextoCliente) => CandidatoSinalizacaoContexto | null;

const PALAVRAS_NUMERO_PT: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, três: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, vinte: 20, trinta: 30,
};

function extrairAnos(trecho: string): number | null {
  const numerico = trecho.match(/(\d+)\s*\(?\s*[a-zçãéê]*\s*\)?\s*anos?/i);
  if (numerico) return Number(numerico[1]);
  const porExtenso = trecho.match(/(um|uma|dois|duas|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|vinte|trinta)\s+anos?/i);
  if (porExtenso) return PALAVRAS_NUMERO_PT[porExtenso[1].toLowerCase()] ?? null;
  return null;
}

// 1. Representação comercial genérica quando o cliente opera por agentes com
// carteira própria e remuneração por volume.
const representacaoComercialGenerica: Heuristica = (clausula, { cliente }) => {
  const mencionaRepresentacao = /representa(?:nte|ção)\s+comercial/i.test(clausula.texto);
  if (!mencionaRepresentacao) return null;

  const jaReflcteVolume = /(remunera[çc][ãa]o|comiss[ãa]o)\s+por\s+volume|carteira\s+pr[óo]pria/i.test(clausula.texto);
  if (jaReflcteVolume) return null;

  const operaPorVolume =
    cliente.preferencias_negociadas.remuneracao_por_volume === true ||
    /agentes?\s+com\s+carteira\s+pr[óo]pria|remunera[çc][ãa]o\s+por\s+volume/i.test(cliente.notas_operacao ?? '');
  if (!operaPorVolume) return null;

  const match = clausula.texto.match(/representa(?:nte|ção)\s+comercial[^.;]*[.;]?/i)!;
  return {
    clausula_numero: clausula.numero,
    trecho_original: match[0],
    offset_inicio: clausula.offset_inicio + match.index!,
    offset_fim: clausula.offset_inicio + match.index! + match[0].length,
    categoria: 'caso_cliente_generico',
    natureza: 'contexto_negocio',
    sugestao_ajuste:
      'Descrever a atuação como agente com carteira própria e remuneração por volume de vendas, não como representação comercial genérica.',
    justificativa:
      'A cláusula descreve representação comercial genérica, mas o cadastro do cliente indica que ele opera por agentes com carteira própria e remuneração por volume — o texto não reflete a operação real.',
    severidade: 'alta',
    fonte_inferencia: {
      tipo: 'cadastro_cliente',
      detalhe: cliente.preferencias_negociadas.remuneracao_por_volume === true
        ? 'clientes.preferencias_negociadas.remuneracao_por_volume = true'
        : `clientes.notas_operacao: "${cliente.notas_operacao}"`,
    },
  };
};

// 2. Parceiro responde pessoalmente quando boa parte da base é pessoa jurídica.
const responsabilidadePessoalComBasePJ: Heuristica = (clausula, { cliente }) => {
  const match = clausula.texto.match(/(?:o\s+)?parceiro\s+responder[áa]\s+pessoal(?:\s+e\s+ilimitadamente)?[^.;]*[.;]?/i);
  if (!match) return null;

  const percentualPJ = Number(cliente.preferencias_negociadas.percentual_socios_pj ?? 0);
  if (percentualPJ < 0.5) return null;

  return {
    clausula_numero: clausula.numero,
    trecho_original: match[0],
    offset_inicio: clausula.offset_inicio + match.index!,
    offset_fim: clausula.offset_inicio + match.index! + match[0].length,
    categoria: 'caso_cliente_generico',
    natureza: 'contexto_negocio',
    sugestao_ajuste:
      'Ajustar a responsabilidade para refletir que a maior parte da base de parceiros deste cliente é pessoa jurídica, limitando a responsabilidade pessoal ao sócio que efetivamente contratar em nome próprio.',
    justificativa: `A cláusula faz o parceiro responder pessoalmente, mas ${Math.round(percentualPJ * 100)}% da base de parceiros deste cliente é pessoa jurídica — a responsabilização pessoal genérica não reflete a estrutura real.`,
    severidade: 'alta',
    fonte_inferencia: {
      tipo: 'cadastro_cliente',
      detalhe: `clientes.preferencias_negociadas.percentual_socios_pj = ${percentualPJ}`,
    },
  };
};

// 3. Cessão de quotas a terceiros permitida quando a holding do cliente tem
// trava de incessibilidade.
const cessaoQuotasComTravaIncessibilidade: Heuristica = (clausula, { cliente }) => {
  const permiteCessao = /cess[ãa]o\s+de\s+quotas?\s+a\s+terceiros?[^.;]*(?:permitida|livremente|independentemente\s+de\s+anu[êe]ncia)[^.;]*[.;]?/i.exec(
    clausula.texto
  );
  if (!permiteCessao) return null;

  if (cliente.preferencias_negociadas.trava_incessibilidade !== true) return null;

  const clausulaOrigemContratoSocial = (cliente.estrutura_societaria as { clausula_trava_incessibilidade?: string })
    .clausula_trava_incessibilidade;

  return {
    clausula_numero: clausula.numero,
    trecho_original: permiteCessao[0],
    offset_inicio: clausula.offset_inicio + permiteCessao.index!,
    offset_fim: clausula.offset_inicio + permiteCessao.index! + permiteCessao[0].length,
    categoria: 'caso_cliente_generico',
    natureza: 'contexto_negocio',
    sugestao_ajuste:
      'Condicionar a cessão de quotas a terceiros à anuência prévia dos demais sócios, conforme a trava de incessibilidade do contrato social desta holding.',
    justificativa:
      'A cláusula permite cessão livre de quotas a terceiros, mas o contrato social desta holding tem trava de incessibilidade — o texto contradiz a estrutura societária real do cliente.',
    severidade: 'alta',
    fonte_inferencia: clausulaOrigemContratoSocial
      ? { tipo: 'clausula_contrato_social', detalhe: clausulaOrigemContratoSocial }
      : { tipo: 'cadastro_cliente', detalhe: 'clientes.preferencias_negociadas.trava_incessibilidade = true' },
  };
};

// 4. Prazo de sigilo padrão quando o escopo envolve dados comerciais sensíveis.
const prazoSigiloAbaixoDoMinimo: Heuristica = (clausula, { cliente, contratosAnteriores }) => {
  if (!/sigilo|confidencialidade/i.test(clausula.texto)) return null;
  const anos = extrairAnos(clausula.texto);
  if (anos === null) return null;

  const dadosSensiveis = cliente.preferencias_negociadas.dados_comerciais_sensiveis === true;
  if (!dadosSensiveis) return null;

  const minimoMeses = Number(cliente.preferencias_negociadas.prazo_sigilo_minimo_meses ?? 0);
  if (minimoMeses === 0 || anos * 12 >= minimoMeses) return null;

  const precedentes = contratosAnteriores.filter(
    (c) => typeof (c.resumo_clausulas as { prazo_sigilo_meses?: number }).prazo_sigilo_meses === 'number'
  );
  const match = clausula.texto.match(/[^.;]*sigilo[^.;]*[.;]?/i) ?? clausula.texto.match(/[^.;]*confidencialidade[^.;]*[.;]?/i)!;

  return {
    clausula_numero: clausula.numero,
    trecho_original: match[0],
    offset_inicio: clausula.offset_inicio + match.index!,
    offset_fim: clausula.offset_inicio + match.index! + match[0].length,
    categoria: 'caso_cliente_generico',
    natureza: 'contexto_negocio',
    sugestao_ajuste: `Ampliar o prazo de sigilo para ao menos ${Math.ceil(minimoMeses / 12)} anos, compatível com o escopo de dados comerciais sensíveis deste cliente.`,
    justificativa: `A cláusula fixa ${anos} ano(s) de sigilo, abaixo do mínimo de ${minimoMeses} meses negociado para este cliente, cujo escopo envolve dados comerciais sensíveis.`,
    severidade: 'media',
    fonte_inferencia:
      precedentes.length > 0
        ? {
            tipo: 'contrato_anterior',
            referencia_id: precedentes[0].id,
            detalhe: `${precedentes.length} contrato(s) anterior(es) deste cliente usaram prazo de sigilo de ${(precedentes[0].resumo_clausulas as { prazo_sigilo_meses?: number }).prazo_sigilo_meses} meses.`,
          }
        : { tipo: 'cadastro_cliente', detalhe: `clientes.preferencias_negociadas.prazo_sigilo_minimo_meses = ${minimoMeses}` },
  };
};

const HEURISTICAS: Heuristica[] = [
  representacaoComercialGenerica,
  responsabilidadePessoalComBasePJ,
  cessaoQuotasComTravaIncessibilidade,
  prazoSigiloAbaixoDoMinimo,
];

/**
 * Categoria 5 (caso do cliente tratado de forma genérica): roda com lógica
 * própria de cruzamento de dados, não por padrão de texto do guia de estilo.
 * Assíncrona por natureza (depende de cruzar cadastro + histórico contratual),
 * por isso vive separada do motor síncrono de estilo.
 */
export function executarHeuristicasDeContextoCliente(
  texto: string,
  cliente: Cliente,
  contratosAnteriores: ClienteContratoAnterior[]
): CandidatoSinalizacaoContexto[] {
  const clausulas = extrairClausulas(texto);
  const candidatos: CandidatoSinalizacaoContexto[] = [];

  for (const clausula of clausulas) {
    for (const heuristica of HEURISTICAS) {
      const candidato = heuristica(clausula, { cliente, contratosAnteriores });
      if (candidato) candidatos.push(candidato);
    }
  }

  return candidatos;
}
