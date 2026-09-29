const BASE_URL = 'https://api.clickup.com/api/v2';

function token(): string {
  const valor = process.env.CLICKUP_API_TOKEN;
  if (!valor) throw new Error('CLICKUP_API_TOKEN não configurado.');
  return valor;
}

async function chamarClickUp<T>(caminho: string): Promise<T> {
  const resposta = await fetch(`${BASE_URL}${caminho}`, { headers: { Authorization: token() } });
  if (!resposta.ok) {
    throw new Error(`Falha na chamada ao ClickUp (${caminho}): ${resposta.status} ${await resposta.text()}`);
  }
  return resposta.json() as Promise<T>;
}

interface ClickUpTarefa {
  id: string;
  name: string;
  status: { status: string };
  list: { id: string; name: string };
  date_updated: string;
}

export interface ClienteCandidatoClickUp {
  tarefaId: string;
  nome: string;
}

/**
 * O ClickUp não tem uma entidade "cliente" de primeira classe no workspace —
 * na prática, o cadastro de clientes é a Lista "Clientes" (ver
 * CLICKUP_LISTA_CLIENTES_ID): cada cliente é uma tarefa dentro dela. As
 * demais Listas do workspace são fluxo de trabalho interno por matéria/área
 * (Cível, Trabalhista, Marketing, OKRs etc.) — não são clientes, e listá-las
 * como candidato já gerou entradas erradas na tela de reconciliação.
 */
export async function listarClientesCandidatosClickUp(): Promise<ClienteCandidatoClickUp[]> {
  const listaClientesId = process.env.CLICKUP_LISTA_CLIENTES_ID;
  if (!listaClientesId) throw new Error('CLICKUP_LISTA_CLIENTES_ID não configurado.');

  const candidatos: ClienteCandidatoClickUp[] = [];
  let page = 0;
  for (;;) {
    const { tasks } = await chamarClickUp<{ tasks: { id: string; name: string }[] }>(
      `/list/${listaClientesId}/task?archived=false&include_closed=true&page=${page}`
    );
    if (tasks.length === 0) break;
    candidatos.push(...tasks.map((t) => ({ tarefaId: t.id, nome: t.name })));
    if (tasks.length < 100) break;
    page++;
  }
  return candidatos;
}

/** Demandas em andamento de uma lista (cliente), para vincular cada minuta à sua task. */
export async function listarTarefasEmAndamento(listaId: string): Promise<ClickUpTarefa[]> {
  const { tasks } = await chamarClickUp<{ tasks: ClickUpTarefa[] }>(`/list/${listaId}/task?archived=false&subtasks=true`);
  return tasks;
}

export async function buscarTarefa(tarefaId: string): Promise<ClickUpTarefa> {
  return chamarClickUp<ClickUpTarefa>(`/task/${tarefaId}`);
}
