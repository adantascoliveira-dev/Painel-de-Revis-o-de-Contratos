export function normalizarRotulo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[*_#:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Cabeçalho de seção da ficha: "## ROTULO", "**ROTULO**" ou "ROTULO: conteúdo"
// (rótulo em maiúsculas seguido de dois-pontos, formato em que as fichas são redigidas).
const CABECALHO_MARKDOWN = /^\s{0,3}#{1,6}\s+(.+?)\s*:?\s*$/u;
const CABECALHO_NEGRITO = /^\s{0,3}\*\*(.+?)\*\*\s*:?\s*$/u;
const CABECALHO_MAIUSCULO = /^\s{0,3}(?:\*\*)?([A-ZÀ-ÝÇ][A-ZÀ-ÝÇ0-9 /()&,.\-ªº]{2,70}?)\s*:(?:\*\*)?(?:\s.*)?$/u;

function rotuloDoCabecalho(linha: string): string | null {
  const m = linha.match(CABECALHO_MARKDOWN) ?? linha.match(CABECALHO_NEGRITO) ?? linha.match(CABECALHO_MAIUSCULO);
  return m ? normalizarRotulo(m[1]) : null;
}

/**
 * Remove a seção "EM ABERTO" (pendências do escritório) de uma ficha. Ela não pode
 * gerar apontamento, então nem chega ao modelo: não depender só da instrução no prompt.
 */
export function removerSecaoEmAberto(markdown: string): string {
  const linhas = markdown.split('\n');
  const resultado: string[] = [];
  let emSecaoEmAberto = false;

  for (const linha of linhas) {
    const rotulo = rotuloDoCabecalho(linha);
    if (rotulo !== null) emSecaoEmAberto = rotulo.startsWith('EM ABERTO');
    if (!emSecaoEmAberto) resultado.push(linha);
  }
  return resultado.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
