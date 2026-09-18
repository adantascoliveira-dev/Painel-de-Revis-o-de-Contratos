import { createSign } from 'node:crypto';

const ESCOPO_LEITURA = 'https://www.googleapis.com/auth/drive.readonly';
const MIME_PASTA = 'application/vnd.google-apps.folder';

interface ArquivoDrive {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  parents?: string[];
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/**
 * Obtém um access token OAuth2 para a conta de serviço via o fluxo JWT Bearer
 * (RFC 7523), sem depender do pacote googleapis — só node:crypto + fetch.
 * Credenciais: GOOGLE_DRIVE_CLIENT_EMAIL / GOOGLE_DRIVE_PRIVATE_KEY.
 */
async function obterTokenAcessoGoogle(): Promise<string> {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) {
    throw new Error('GOOGLE_DRIVE_CLIENT_EMAIL / GOOGLE_DRIVE_PRIVATE_KEY não configurados.');
  }

  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corpo = base64Url(
    JSON.stringify({
      iss: clientEmail,
      scope: ESCOPO_LEITURA,
      aud: 'https://oauth2.googleapis.com/token',
      iat: agora,
      exp: agora + 3600,
    })
  );
  const assinatura = createSign('RSA-SHA256').update(`${cabecalho}.${corpo}`).sign(privateKey);
  const jwt = `${cabecalho}.${corpo}.${base64Url(assinatura)}`;

  const resposta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!resposta.ok) {
    throw new Error(`Falha ao obter token do Google Drive: ${resposta.status} ${await resposta.text()}`);
  }
  const { access_token } = (await resposta.json()) as { access_token: string };
  return access_token;
}

async function listarFilhos(pastaId: string, token: string): Promise<ArquivoDrive[]> {
  const arquivos: ArquivoDrive[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${pastaId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, parents)',
      pageSize: '200',
      // A pasta raiz de clientes é um Drive Compartilhado — sem esses dois
      // parâmetros a API do Drive simplesmente omite os itens dele do
      // resultado (sem erro nenhum, só volta vazio).
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const resposta = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resposta.ok) {
      throw new Error(`Falha ao listar pasta ${pastaId} no Google Drive: ${resposta.status}`);
    }
    const pagina = (await resposta.json()) as { files: ArquivoDrive[]; nextPageToken?: string };
    arquivos.push(...pagina.files);
    pageToken = pagina.nextPageToken;
  } while (pageToken);

  return arquivos;
}

export interface PastaClienteDrive {
  nome: string;
  pastaId: string;
  arquivos: ArquivoDrive[];
}

/**
 * Varre a árvore de planejamento patrimonial e sucessório: cada subpasta de
 * primeiro nível é tratada como um cliente candidato (nome da pasta = nome do
 * cliente), e seus arquivos viram candidatos a modelo aprovado / histórico
 * contratual depois que o sócio confirma a reconciliação.
 */
export async function listarPastasDeClientes(): Promise<PastaClienteDrive[]> {
  const pastaRaizId = process.env.GOOGLE_DRIVE_PLANEJAMENTO_PATRIMONIAL_FOLDER_ID;
  if (!pastaRaizId) {
    throw new Error('GOOGLE_DRIVE_PLANEJAMENTO_PATRIMONIAL_FOLDER_ID não configurado.');
  }

  const token = await obterTokenAcessoGoogle();
  const subpastas = (await listarFilhos(pastaRaizId, token)).filter((f) => f.mimeType === MIME_PASTA);

  const resultado: PastaClienteDrive[] = [];
  for (const pasta of subpastas) {
    const arquivos = await listarFilhos(pasta.id, token);
    resultado.push({ nome: pasta.name, pastaId: pasta.id, arquivos: arquivos.filter((a) => a.mimeType !== MIME_PASTA) });
  }
  return resultado;
}
