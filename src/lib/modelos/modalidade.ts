import type { ModalidadeContrato } from '@/types/database.types';

// Sinais textuais de cada modalidade. Conta categorias distintas que aparecem, não ocorrências.
const SINAIS_CONTINUO: RegExp[] = [
  /relat[óo]rio\s+mensal/i,
  /valor\s+mensal|remunera[çc][ãa]o\s+mensal|mensalmente|por\s+m[eê]s\b/i,
  /vig[êe]ncia[^.\n]{0,100}\b(?:12|doze|24|vinte\s+e\s+quatro|36|trinta\s+e\s+seis)\s*(?:\([^)]*\)\s*)?meses/i,
  /prorroga[çc][ãa]o|renova[çc][ãa]o/i,
  /gestor\s+do\s+contrato/i,
  /prazo\s+indeterminado/i,
];

const SINAIS_PONTUAL: RegExp[] = [
  /\b(?:evento|show|turn[êe]|festival|temporada|espet[áa]culo|montagem|desmontagem|congresso|feira)\b/i,
  /valor\s+(?:[úu]nico|global|total)|pagamento\s+[úu]nico|parcela\s+[úu]nica|entreg[áa]vel\s+[úu]nico/i,
  /conclus[ãa]o\s+d[oa]\s+(?:evento|projeto|obra|servi[çc]o)|entrega\s+final|t[ée]rmino\s+do\s+evento/i,
  /pelo\s+prazo\s+de\s+\d+\s*(?:\([^)]*\)\s*)?dias/i,
  /data\s+do\s+evento|dias?\s+do\s+evento|per[íi]odo\s+d[oa]\s+(?:evento|projeto)/i,
];

function pontuar(texto: string, sinais: RegExp[]): number {
  return sinais.filter((s) => s.test(texto)).length;
}

/**
 * Identifica a modalidade de um contrato de prestação de serviços pelo texto da minuta:
 * relação recorrente = contínuo; evento ou projeto com fim definido = pontual. Só decide
 * com pelo menos dois sinais e vantagem sobre a outra modalidade; na dúvida devolve null,
 * e o painel não compara a minuta com modelo de modalidade nenhuma.
 */
export function identificarModalidade(texto: string): ModalidadeContrato | null {
  const continuo = pontuar(texto, SINAIS_CONTINUO);
  const pontual = pontuar(texto, SINAIS_PONTUAL);
  if (continuo >= 2 && continuo > pontual) return 'continuo';
  if (pontual >= 2 && pontual > continuo) return 'pontual';
  return null;
}
