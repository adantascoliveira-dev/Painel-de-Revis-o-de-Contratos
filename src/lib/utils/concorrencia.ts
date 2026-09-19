/**
 * Aplica `tarefa` a cada item de `itens`, no máximo `limite` execuções em
 * paralelo por vez. Usado nos syncs de Drive/ClickUp — centenas de pastas
 * processadas uma por vez (await sequencial num for) estouram o tempo que o
 * navegador/gateway aguenta esperar por uma resposta, mesmo quando o backend
 * termina o trabalho.
 */
export async function mapComLimite<T, R>(itens: T[], limite: number, tarefa: (item: T) => Promise<R>): Promise<R[]> {
  const resultado: R[] = new Array(itens.length);
  let proximo = 0;

  async function worker() {
    while (proximo < itens.length) {
      const indice = proximo++;
      resultado[indice] = await tarefa(itens[indice]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, worker));
  return resultado;
}
