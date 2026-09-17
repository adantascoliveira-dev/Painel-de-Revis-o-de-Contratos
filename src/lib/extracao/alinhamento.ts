import type { Clausula } from '@/types/database.types';

export interface ParClausulas {
  numero: string | null;
  clausulaModelo: Clausula | null;
  clausulaMinuta: Clausula | null;
  /** 'numero' = alinhado por numeração igual; 'posicao' = numeração não bateu, alinhado pela ordem; 'sem_par' = só existe de um lado. */
  origemAlinhamento: 'numero' | 'posicao' | 'sem_par';
}

function normalizarNumero(numero: string | null): string | null {
  if (!numero) return null;
  // "1ª" e "I" (romano) não normalizam para o mesmo formato de "1"/"1.1" —
  // aqui só tratamos variações triviais (zero à esquerda, espaços).
  return numero.trim().replace(/^0+(\d)/, '$1');
}

/**
 * Alinha cláusulas do modelo aprovado com as da minuta enviada, para a
 * comparação lado a lado da Tela 2. Prioriza casar por número de cláusula;
 * quando a numeração diverge (peça reestruturada, numeração livre etc.), cai
 * para alinhamento posicional — sinalizando a origem para a UI decidir como
 * exibir a confiança do pareamento.
 */
export function alinharClausulas(clausulasModelo: Clausula[], clausulasMinuta: Clausula[]): ParClausulas[] {
  const modeloComNumero = clausulasModelo.filter((c) => c.numero !== null);
  const minutaComNumero = clausulasMinuta.filter((c) => c.numero !== null);

  // A numeração é considerada compatível quando toda cláusula numerada da
  // MINUTA tem correspondente no modelo — não o contrário: é normal e
  // esperado que o modelo tenha cláusulas que a minuta ainda não tem (é
  // exatamente isso que a categoria 6, cláusulas ausentes, existe para achar).
  // Exigir a via inversa faria qualquer minuta incompleta cair no alinhamento
  // posicional, degradando a comparação inteira por causa da própria cláusula
  // que se quer detectar como ausente.
  const numerosBatem =
    modeloComNumero.length > 0 &&
    minutaComNumero.length > 0 &&
    minutaComNumero.every((m) =>
      modeloComNumero.some((c) => normalizarNumero(c.numero) === normalizarNumero(m.numero))
    );

  if (numerosBatem) {
    const pares: ParClausulas[] = [];
    const numerosVistos = new Set<string>();

    for (const clausulaModelo of modeloComNumero) {
      const num = normalizarNumero(clausulaModelo.numero)!;
      numerosVistos.add(num);
      const clausulaMinuta = minutaComNumero.find((m) => normalizarNumero(m.numero) === num) ?? null;
      pares.push({ numero: clausulaModelo.numero, clausulaModelo, clausulaMinuta, origemAlinhamento: clausulaMinuta ? 'numero' : 'sem_par' });
    }
    // Cláusulas que só existem na minuta (numeração nova, adicionada pela equipe).
    for (const clausulaMinuta of minutaComNumero) {
      const num = normalizarNumero(clausulaMinuta.numero)!;
      if (!numerosVistos.has(num)) {
        pares.push({ numero: clausulaMinuta.numero, clausulaModelo: null, clausulaMinuta, origemAlinhamento: 'sem_par' });
      }
    }
    return pares;
  }

  // Numeração não é compatível entre modelo e minuta: alinha pela ordem em que
  // as cláusulas aparecem, marcando a origem como "posicao" (menor confiança).
  const tamanho = Math.max(clausulasModelo.length, clausulasMinuta.length);
  const pares: ParClausulas[] = [];
  for (let i = 0; i < tamanho; i++) {
    const clausulaModelo = clausulasModelo[i] ?? null;
    const clausulaMinuta = clausulasMinuta[i] ?? null;
    pares.push({
      numero: clausulaMinuta?.numero ?? clausulaModelo?.numero ?? null,
      clausulaModelo,
      clausulaMinuta,
      origemAlinhamento: clausulaModelo && clausulaMinuta ? 'posicao' : 'sem_par',
    });
  }
  return pares;
}
