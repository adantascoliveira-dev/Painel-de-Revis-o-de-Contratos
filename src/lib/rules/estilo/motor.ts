import { separarPreambulo } from '@/lib/extracao/clausulas';
import { alinharClausulas } from '@/lib/extracao/alinhamento';
import type { CategoriaSinalizacao, Clausula, RegraEstilo, SeveridadeSinalizacao } from '@/types/database.types';

export interface CandidatoSinalizacaoEstilo {
  trecho_original: string;
  offset_inicio: number;
  offset_fim: number;
  categoria: CategoriaSinalizacao;
  natureza: 'estilo';
  sugestao_ajuste: string;
  justificativa: string;
  severidade: SeveridadeSinalizacao;
  regra_estilo_id: string;
}

function interpolarSubstituto(substituto: string, match: RegExpMatchArray): string {
  return substituto.replace(/\$(&|\d)/g, (_, grupo: string) =>
    grupo === '&' ? match[0] : (match[Number(grupo)] ?? '')
  );
}

function detectarPorRegex(texto: string, regra: RegraEstilo): CandidatoSinalizacaoEstilo[] {
  if (regra.padrao_deteccao.tipo !== 'regex_lista') return [];
  const { padroes, flags } = regra.padrao_deteccao;
  const flagsFinais = (flags ?? 'gi').includes('g') ? flags ?? 'gi' : `${flags ?? 'i'}g`;

  const candidatos: CandidatoSinalizacaoEstilo[] = [];
  for (const padrao of padroes) {
    const regex = new RegExp(padrao.regex, flagsFinais);
    for (const match of texto.matchAll(regex)) {
      if (match.index === undefined) continue;
      candidatos.push({
        trecho_original: match[0],
        offset_inicio: match.index,
        offset_fim: match.index + match[0].length,
        categoria: regra.categoria,
        natureza: 'estilo',
        sugestao_ajuste: interpolarSubstituto(padrao.substituto, match),
        justificativa: `${regra.nome}: ${regra.texto_orientacao}`,
        severidade: regra.severidade_default,
        regra_estilo_id: regra.id,
      });
    }
  }
  return candidatos;
}

const TAMANHO_JANELA_PALAVRAS = 8;
const TAMANHO_MINIMO_TRECHO = 30; // caracteres; abaixo disso não vale a pena marcar

function normalizarPalavra(p: string): string {
  return p.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Heurística de "qualificação do preâmbulo repetida no corpo": procura, dentro
 * de cada cláusula, a maior sequência contígua de palavras que também aparece
 * (na mesma ordem) no preâmbulo. Sequências >= TAMANHO_JANELA_PALAVRAS palavras
 * e >= TAMANHO_MINIMO_TRECHO caracteres viram sinalização.
 */
function detectarQualificacaoRepetida(texto: string, regra: RegraEstilo): CandidatoSinalizacaoEstilo[] {
  if (regra.padrao_deteccao.tipo !== 'similaridade_preambulo') return [];

  const { preambulo, corpo, offsetCorpo } = separarPreambulo(texto);
  if (!preambulo.trim() || !corpo.trim()) return [];

  // Tokeniza preservando offsets de cada palavra no texto original do corpo.
  const tokensCorpo = [...corpo.matchAll(/\S+/g)].map((m) => ({
    palavra: normalizarPalavra(m[0]),
    inicio: offsetCorpo + m.index!,
    fim: offsetCorpo + m.index! + m[0].length,
  }));
  const palavrasPreambulo = (preambulo.match(/\S+/g) ?? []).map(normalizarPalavra);

  const shinglesPreambulo = new Set<string>();
  for (let i = 0; i + TAMANHO_JANELA_PALAVRAS <= palavrasPreambulo.length; i++) {
    shinglesPreambulo.add(palavrasPreambulo.slice(i, i + TAMANHO_JANELA_PALAVRAS).join(' '));
  }
  if (shinglesPreambulo.size === 0) return [];

  const candidatos: CandidatoSinalizacaoEstilo[] = [];
  let i = 0;
  while (i + TAMANHO_JANELA_PALAVRAS <= tokensCorpo.length) {
    const janela = tokensCorpo.slice(i, i + TAMANHO_JANELA_PALAVRAS).map((t) => t.palavra).join(' ');
    if (!shinglesPreambulo.has(janela)) {
      i++;
      continue;
    }
    // Achou o início de uma repetição: estende palavra a palavra enquanto o
    // trecho continuar existindo no preâmbulo (como substring de palavras).
    let fimJanela = i + TAMANHO_JANELA_PALAVRAS;
    while (fimJanela < tokensCorpo.length) {
      const candidataMaior = tokensCorpo
        .slice(i, fimJanela + 1)
        .map((t) => t.palavra)
        .join(' ');
      if (palavrasPreambulo.join(' ').includes(candidataMaior)) {
        fimJanela++;
      } else {
        break;
      }
    }

    const inicioOffset = tokensCorpo[i].inicio;
    const fimOffset = tokensCorpo[fimJanela - 1].fim;
    const trecho = texto.slice(inicioOffset, fimOffset);

    if (trecho.length >= TAMANHO_MINIMO_TRECHO) {
      candidatos.push({
        trecho_original: trecho,
        offset_inicio: inicioOffset,
        offset_fim: fimOffset,
        categoria: regra.categoria,
        natureza: 'estilo',
        sugestao_ajuste: '',
        justificativa: `${regra.nome}: ${regra.texto_orientacao}`,
        severidade: regra.severidade_default,
        regra_estilo_id: regra.id,
      });
    }

    i = fimJanela;
  }

  return candidatos;
}

/** Remove candidatos cujo trecho se sobrepõe a um candidato já aceito (mantém o primeiro por posição). */
function removerSobreposicoes(candidatos: CandidatoSinalizacaoEstilo[]): CandidatoSinalizacaoEstilo[] {
  const ordenados = [...candidatos].sort((a, b) => a.offset_inicio - b.offset_inicio);
  const resultado: CandidatoSinalizacaoEstilo[] = [];
  let fimUltimoAceito = -1;
  for (const candidato of ordenados) {
    if (candidato.offset_inicio >= fimUltimoAceito) {
      resultado.push(candidato);
      fimUltimoAceito = candidato.offset_fim;
    }
  }
  return resultado;
}

function candidatarTodasAsRegras(texto: string, regras: RegraEstilo[]): CandidatoSinalizacaoEstilo[] {
  const candidatos: CandidatoSinalizacaoEstilo[] = [];
  for (const regra of regras) {
    if (!regra.ativo) continue;
    if (regra.padrao_deteccao.tipo === 'regex_lista') {
      candidatos.push(...detectarPorRegex(texto, regra));
    } else if (regra.padrao_deteccao.tipo === 'similaridade_preambulo') {
      candidatos.push(...detectarQualificacaoRepetida(texto, regra));
    }
  }
  return candidatos;
}

/**
 * Executa as categorias 1-4 (estilo) contra o texto de trabalho de um documento.
 * Síncrono por natureza — não depende de nada além do texto e das regras vigentes.
 */
export function executarMotorDeEstilo(texto: string, regras: RegraEstilo[]): CandidatoSinalizacaoEstilo[] {
  return removerSobreposicoes(candidatarTodasAsRegras(texto, regras));
}

/**
 * Pares de candidatos de regras DIFERENTES cujos trechos se sobrepõem — é o
 * caso de "duas regras do guia dão orientações conflitantes" que, na Tela 3,
 * vira um ponto que exige julgamento humano em vez de aplicação automática.
 * executarMotorDeEstilo já resolve essas sobreposições (mantém só a primeira)
 * para que o lote de aplicação nunca opere sobre trechos conflitantes; esta
 * função serve para a camada de revisão final enxergar o conflito em si.
 */
export function detectarConflitosEntreRegras(
  texto: string,
  regras: RegraEstilo[]
): [CandidatoSinalizacaoEstilo, CandidatoSinalizacaoEstilo][] {
  const ordenados = candidatarTodasAsRegras(texto, regras).sort((a, b) => a.offset_inicio - b.offset_inicio);
  const conflitos: [CandidatoSinalizacaoEstilo, CandidatoSinalizacaoEstilo][] = [];

  for (let i = 0; i < ordenados.length; i++) {
    for (let j = i + 1; j < ordenados.length; j++) {
      if (ordenados[j].offset_inicio >= ordenados[i].offset_fim) break;
      if (ordenados[i].regra_estilo_id !== ordenados[j].regra_estilo_id) {
        conflitos.push([ordenados[i], ordenados[j]]);
      }
    }
  }
  return conflitos;
}

/**
 * Categoria 6 (cláusulas ausentes): compara a estrutura da minuta com a do
 * modelo aprovado via o mesmo alinhamento usado na Tela 2 e sinaliza toda
 * cláusula do modelo que não tem par na minuta. Como não há um trecho a
 * substituir (a cláusula simplesmente não existe no texto), a sinalização usa
 * um "ponto de inserção" de largura zero (offset_inicio === offset_fim), logo
 * depois de onde a última cláusula correspondente termina na minuta.
 */
export function detectarClausulasAusentes(
  clausulasModelo: Clausula[],
  clausulasMinuta: Clausula[],
  regra: RegraEstilo
): CandidatoSinalizacaoEstilo[] {
  if (regra.padrao_deteccao.tipo !== 'comparacao_com_modelo') return [];
  if (clausulasModelo.length === 0) return [];

  const pares = alinharClausulas(clausulasModelo, clausulasMinuta);
  const candidatos: CandidatoSinalizacaoEstilo[] = [];
  let offsetInsercao = 0;

  for (const par of pares) {
    if (par.clausulaMinuta) {
      offsetInsercao = par.clausulaMinuta.offset_fim;
      continue;
    }
    if (!par.clausulaModelo) continue;

    candidatos.push({
      trecho_original: '',
      offset_inicio: offsetInsercao,
      offset_fim: offsetInsercao,
      categoria: 'clausulas_ausentes',
      natureza: 'estilo',
      sugestao_ajuste: `\n\n${par.clausulaModelo.texto.trim()}`,
      justificativa: `${regra.nome}: a cláusula ${par.clausulaModelo.numero ?? ''} do modelo aprovado${
        par.clausulaModelo.titulo ? ` (${par.clausulaModelo.titulo})` : ''
      } não aparece na minuta.`,
      severidade: regra.severidade_default,
      regra_estilo_id: regra.id,
    });
  }

  return candidatos;
}
