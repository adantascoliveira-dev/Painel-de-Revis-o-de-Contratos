import type { Clausula } from '@/types/database.types';

// "CLÁUSULA SEGUNDA", "CLÁUSULA DÉCIMA PRIMEIRA" etc. — estilo comum em
// contratos do escritório. Ordenado da frase mais longa para a mais curta:
// numa alternação regex, "DÉCIMA PRIMEIRA" precisa ser tentado antes de
// "DÉCIMA" sozinho, senão o "PRIMEIRA" sobra de fora do match.
const ORDINAIS_POR_EXTENSO: [string, string][] = [
  ['DÉCIMA NONA', '19'], ['DÉCIMA OITAVA', '18'], ['DÉCIMA SÉTIMA', '17'], ['DÉCIMA SEXTA', '16'],
  ['DÉCIMA QUINTA', '15'], ['DÉCIMA QUARTA', '14'], ['DÉCIMA TERCEIRA', '13'], ['DÉCIMA SEGUNDA', '12'],
  ['DÉCIMA PRIMEIRA', '11'], ['VIGÉSIMA', '20'], ['DÉCIMA', '10'],
  ['PRIMEIRA', '1'], ['SEGUNDA', '2'], ['TERCEIRA', '3'], ['QUARTA', '4'], ['QUINTA', '5'],
  ['SEXTA', '6'], ['SÉTIMA', '7'], ['OITAVA', '8'], ['NONA', '9'],
];
const MAPA_ORDINAIS = new Map(ORDINAIS_POR_EXTENSO.map(([palavra, numero]) => [palavra, numero]));
const ALTERNATIVA_ORDINAIS = ORDINAIS_POR_EXTENSO.map(([palavra]) =>
  palavra.replace(/É/g, '[ÉE]').replace(' ', '\\s+')
).join('|');

function normalizarOrdinalPorExtenso(texto: string): string | null {
  const chave = texto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const semAcento = ORDINAIS_POR_EXTENSO.find(
    ([palavra]) => palavra.normalize('NFD').replace(/[̀-ͯ]/g, '') === chave
  );
  return semAcento ? MAPA_ORDINAIS.get(semAcento[0])! : null;
}

// Reconhece três estilos de numeração comuns nas minutas do escritório:
//   "CLÁUSULA 3ª - DO PREÇO"          (numeral/romano + título)
//   "CLÁUSULA SEGUNDA — DO OBJETO"    (ordinal por extenso + título)
//   "3.2 Reajuste anual"              (numeração decimal)
// O texto antes da primeira ocorrência é tratado como preâmbulo (numero: null).
// A alternativa por extenso vem ANTES da classe de numeral romano: "DÉCIMA" e
// "VIGÉSIMA" começam com D/V, que também são algarismos romanos válidos —
// numa alternação regex vence quem casa primeiro, não quem casa mais
// caracteres, então "[0-9IVXLCDM]+" primeiro faria "DÉCIMA" virar só "D".
const PADRAO_CABECALHO_CLAUSULA = new RegExp(
  `^(?:CL[ÁA]USULA\\s+(${ALTERNATIVA_ORDINAIS}|[0-9IVXLCDM]+)[ªa]?\\.?\\s*[-–—:.)]?\\s*([^\\n]*)|(\\d+(?:\\.\\d+)*)[.\\-–—)]?\\s+([^\\n]*))`,
  'gim'
);

/**
 * Divide o texto em cláusulas com offsets no texto original, preservando a
 * numeração de cada uma. Quando nenhum cabeçalho é reconhecido, devolve uma
 * única "cláusula" cobrindo o texto inteiro (numero: null), para que o resto
 * do sistema (alinhamento, motor de regras) sempre tenha algo para iterar.
 */
export function extrairClausulas(texto: string): Clausula[] {
  const cabecalhos: { indice: number; numero: string; titulo: string }[] = [];

  for (const match of texto.matchAll(PADRAO_CABECALHO_CLAUSULA)) {
    const numeroBruto = match[1] ?? match[3] ?? null;
    const titulo = (match[2] ?? match[4] ?? '').trim();
    if (numeroBruto === null) continue;
    const numero = normalizarOrdinalPorExtenso(numeroBruto) ?? numeroBruto;
    cabecalhos.push({ indice: match.index, numero, titulo });
  }

  if (cabecalhos.length === 0) {
    return [{ numero: null, titulo: null, texto, offset_inicio: 0, offset_fim: texto.length }];
  }

  const clausulas: Clausula[] = [];

  if (cabecalhos[0].indice > 0) {
    clausulas.push({
      numero: null,
      titulo: null,
      texto: texto.slice(0, cabecalhos[0].indice),
      offset_inicio: 0,
      offset_fim: cabecalhos[0].indice,
    });
  }

  for (let i = 0; i < cabecalhos.length; i++) {
    const atual = cabecalhos[i];
    const proximo = cabecalhos[i + 1];
    const offsetFim = proximo ? proximo.indice : texto.length;
    clausulas.push({
      numero: atual.numero,
      titulo: atual.titulo || null,
      texto: texto.slice(atual.indice, offsetFim),
      offset_inicio: atual.indice,
      offset_fim: offsetFim,
    });
  }

  return clausulas;
}

/** Só a fronteira preâmbulo/corpo, usada pela regra de "qualificação repetida". */
export function separarPreambulo(texto: string): { preambulo: string; corpo: string; offsetCorpo: number } {
  PADRAO_CABECALHO_CLAUSULA.lastIndex = 0;
  const primeiraOcorrencia = PADRAO_CABECALHO_CLAUSULA.exec(texto);
  if (!primeiraOcorrencia) {
    return { preambulo: texto, corpo: '', offsetCorpo: texto.length };
  }
  return {
    preambulo: texto.slice(0, primeiraOcorrencia.index),
    corpo: texto.slice(primeiraOcorrencia.index),
    offsetCorpo: primeiraOcorrencia.index,
  };
}
