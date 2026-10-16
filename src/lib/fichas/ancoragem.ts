function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Localiza no texto da minuta o trecho que o modelo citou. O modelo só pode apontar
 * o que existe de verdade: sem correspondência, o apontamento é descartado em vez
 * de ser gravado com posição inventada. Tolera diferença de espaços e quebras de linha.
 */
export function localizarTrecho(texto: string, trecho: string): { inicio: number; fim: number } | null {
  const procurado = trecho.trim();
  if (!procurado) return null;

  const exato = texto.indexOf(procurado);
  if (exato !== -1) return { inicio: exato, fim: exato + procurado.length };

  const padrao = procurado.split(/\s+/).map(escaparRegex).join('\\s+');
  const correspondencia = new RegExp(padrao, 'u').exec(texto);
  if (!correspondencia) return null;
  return { inicio: correspondencia.index, fim: correspondencia.index + correspondencia[0].length };
}
