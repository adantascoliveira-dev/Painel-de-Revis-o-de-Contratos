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

function tituloNormalizado(titulo: string | null): string | null {
  if (!titulo) return null;
  const limpo = titulo
    .replace(/\[[^\]]*\]/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:D[OAE]S?\s+)+/, '');
  return limpo || null;
}

function ehCabecaDeCapitulo(clausula: Clausula): boolean {
  return clausula.numero !== null && !clausula.numero.includes('.');
}

/**
 * Cláusula condicional do modelo omitida na minuta (ex.: "Propriedade intelectual", só quando o
 * serviço gera obra) desloca a numeração das seguintes: a "9" da minuta passa a ser a "10" do
 * modelo. Só por número, a última cláusula do modelo pareceria ausente. Quando ao menos duas
 * cláusulas de capítulo da minuta casam com o modelo pelo título e a numeração difere, a minuta
 * é renumerada (capítulo e subitens) para a numeração do modelo antes do pareamento.
 */
function renumerarMinutaPorTitulo(clausulasModelo: Clausula[], clausulasMinuta: Clausula[]): Clausula[] {
  const numeroPorTitulo = new Map<string, string>();
  for (const c of clausulasModelo) {
    const titulo = ehCabecaDeCapitulo(c) ? tituloNormalizado(c.titulo) : null;
    if (titulo && !numeroPorTitulo.has(titulo)) numeroPorTitulo.set(titulo, c.numero!);
  }

  const mapa = new Map<string, string>();
  for (const c of clausulasMinuta) {
    const titulo = ehCabecaDeCapitulo(c) ? tituloNormalizado(c.titulo) : null;
    const alvo = titulo ? numeroPorTitulo.get(titulo) : undefined;
    if (alvo !== undefined) mapa.set(c.numero!, alvo);
  }

  const houveDeslocamento = [...mapa].some(([deMinuta, doModelo]) => normalizarNumero(deMinuta) !== normalizarNumero(doModelo));
  if (mapa.size < 2 || !houveDeslocamento) return clausulasMinuta;

  return clausulasMinuta.map((c) => {
    if (c.numero === null) return c;
    const capitulo = c.numero.split('.')[0];
    const alvo = mapa.get(capitulo);
    return alvo === undefined ? c : { ...c, numero: alvo + c.numero.slice(capitulo.length) };
  });
}

/**
 * Alinha cláusulas do modelo aprovado com as da minuta enviada, para a
 * comparação lado a lado da Tela 2. Prioriza casar por número de cláusula;
 * quando a numeração diverge (peça reestruturada, numeração livre etc.), cai
 * para alinhamento posicional — sinalizando a origem para a UI decidir como
 * exibir a confiança do pareamento.
 */
export function alinharClausulas(clausulasModelo: Clausula[], clausulasMinutaBruta: Clausula[]): ParClausulas[] {
  const clausulasMinuta = renumerarMinutaPorTitulo(clausulasModelo, clausulasMinutaBruta);
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
