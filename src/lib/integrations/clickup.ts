import { mapComLimite } from '@/lib/utils/concorrencia';

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

interface ClickUpLista {
  id: string;
  name: string;
}
interface ClickUpPasta {
  id: string;
  name: string;
  lists: ClickUpLista[];
}
interface ClickUpEspaco {
  id: string;
  name: string;
}
interface ClickUpTarefa {
  id: string;
  name: string;
  status: { status: string };
  list: { id: string; name: string };
  date_updated: string;
}

export interface ListaClickUp {
  espacoNome: string;
  pastaNome: string | null;
  listaId: string;
  listaNome: string;
}

/**
 * O ClickUp não tem uma entidade "cliente" de primeira classe no escritório —
 * na prática, cada Lista (dentro de uma Pasta, dentro de um Espaço) representa
 * um cliente. Achata essa hierarquia para alimentar a tela de reconciliação.
 */
export async function listarListasComoClientesCandidatos(): Promise<ListaClickUp[]> {
  const workspaceId = process.env.CLICKUP_WORKSPACE_ID;
  if (!workspaceId) throw new Error('CLICKUP_WORKSPACE_ID não configurado.');

  const { spaces } = await chamarClickUp<{ spaces: ClickUpEspaco[] }>(`/team/${workspaceId}/space?archived=false`);

  const porEspaco = await mapComLimite(spaces, 5, async (espaco) => {
    const listasDoEspaco: ListaClickUp[] = [];
    const { folders } = await chamarClickUp<{ folders: ClickUpPasta[] }>(`/space/${espaco.id}/folder?archived=false`);
    for (const pasta of folders) {
      for (const lista of pasta.lists) {
        listasDoEspaco.push({ espacoNome: espaco.name, pastaNome: pasta.name, listaId: lista.id, listaNome: lista.name });
      }
    }

    const { lists: listasSemPasta } = await chamarClickUp<{ lists: ClickUpLista[] }>(
      `/space/${espaco.id}/list?archived=false`
    );
    for (const lista of listasSemPasta) {
      listasDoEspaco.push({ espacoNome: espaco.name, pastaNome: null, listaId: lista.id, listaNome: lista.name });
    }
    return listasDoEspaco;
  });

  return porEspaco.flat();
}

/** Demandas em andamento de uma lista (cliente), para vincular cada minuta à sua task. */
export async function listarTarefasEmAndamento(listaId: string): Promise<ClickUpTarefa[]> {
  const { tasks } = await chamarClickUp<{ tasks: ClickUpTarefa[] }>(`/list/${listaId}/task?archived=false&subtasks=true`);
  return tasks;
}

export async function buscarTarefa(tarefaId: string): Promise<ClickUpTarefa> {
  return chamarClickUp<ClickUpTarefa>(`/task/${tarefaId}`);
}
