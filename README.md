# Painel de Revisão de Minutas — Braga e Dantas

Sistema que compara minutas com os modelos aprovados do escritório, sinaliza desvios do
padrão de comunicação antes da revisão final do sócio, e acumula o histórico de correções
por integrante. Cobre modelo de dados, regras de análise, fluxo de estado, integrações e
o frontend das 4 telas, a partir do design canvas entregue pelo escritório.

## Stack

- **Next.js 16 (App Router) + TypeScript** — API em `src/app/api/**/route.ts`, telas em
  `src/app/(painel)/**` (Server Components buscando dados + Client Components para a
  interação).
- **Supabase (Postgres + Auth + Storage)** — schema, RLS e as regras de negócio mais
  críticas vivem como funções `SECURITY DEFINER` no próprio banco
  (`supabase/migrations`), não só na aplicação. Isso garante que a trilha de auditoria e
  as regras de permissão valem mesmo se alguém acessar o banco fora da API.
- **Vitest** — testes unitários do motor de regras, extração de cláusulas e heurísticas
  de contexto do cliente (tudo em `src/lib`, sem precisar de banco).
- **PGlite** — usado só em `scripts/` para validar as migrações e simular o ciclo de vida
  completo de um documento sem precisar de Docker/Supabase CLI local.

Já existe um projeto Supabase real para isto (**Painel de Revisão de Contratos**, org.
Braga e Dantas Advogados) — a conexão e a aplicação das migrações nele ficaram para uma
sessão à parte; até lá, tudo aqui foi validado localmente (ver "Rodando localmente").

## Estrutura

```
supabase/migrations/     schema, RLS, funções de negócio, seed do guia de estilo v4
supabase/seed.sql        dados de dev (clientes reais do mockup) — gitignored, só local
supabase/seed.example.sql  template de seed sem dados reais
src/lib/extracao/        extração de texto (.docx/.pdf/.odt) e de cláusulas numeradas
src/lib/rules/estilo/    motor de regras síncrono (categorias 1, 2, 3, 4 e 6)
src/lib/rules/contexto-cliente/  heurísticas de cruzamento com o cadastro do cliente (categoria 5)
src/lib/services/        orquestração: documentos, checagem, revisão, histórico, reconciliação
src/lib/integrations/    clientes de Google Drive e ClickUp
src/app/api/             rotas HTTP que expõem os serviços acima
src/app/(painel)/        as 4 telas + lista de documentos, atrás do layout com a barra lateral
src/app/login/           autenticação (e-mail/senha via Supabase Auth)
src/components/          Sidebar, TextoComMarcas (destaque de sinalizações no texto), Corners
tests/                   testes unitários (vitest)
scripts/                 validação de schema e teste de fluxo ponta a ponta via PGlite
```

## Modelo de dados (resumo)

- **`documentos`** — a minuta e seu estado (`rascunho` → `em_checagem` → `aguardando_socio`
  ⇄ `em_ajuste_pela_equipe` → `aprovado`). Todo texto em edição fica em `texto_trabalho`;
  `texto_extraido` nunca é reescrito.
- **`documento_transicoes`** / **`documento_snapshots`** — trilha de auditoria e
  versionamento completo, imutáveis por trigger (nem o dono da tabela consegue
  `UPDATE`/`DELETE`).
- **`sinalizacoes`** — cada desvio apontado na checagem, com `natureza` = `estilo`
  (categorias 1, 2, 3, 4 e 6 — síncronas) ou `contexto_negocio` (categoria 5, assíncrona),
  offsets no texto, sugestão de ajuste e (para contexto de negócio) a fonte da inferência.
  `offset_fim === offset_inicio` é um ponto de inserção pura (usado pela categoria 6,
  cláusula ausente — não há trecho a substituir).
- **`correcoes`** — o que o sócio mudou na revisão final, sempre vinculado ao autor
  original da minuta. É a base dos perfis da equipe (Tela 4).
- **`modelos_aprovados`** / **`guias_estilo`** / **`regras_estilo`** — o padrão contra o
  qual tudo é comparado. Só um sócio promove um documento a modelo.
- **`clientes`** / **`cliente_contratos_anteriores`** — cadastro canônico e histórico
  contratual, usados pela categoria 5.
- **`fontes_reconciliacao`** — candidatos a cliente lidos do Drive/ClickUp; só viram
  `clientes` depois que o sócio confirma (tela de reconciliação).

Toda mutação sensível (transição de status, aplicar/manter sinalização, corrigir
diretamente, aprovar, promover a modelo, confirmar reconciliação, vincular task do
ClickUp) passa por uma função `SECURITY DEFINER` no Postgres — ver
`supabase/migrations/20260917091100_funcoes_negocio.sql`. A API chama essas funções via
`.rpc(...)`; nunca faz `UPDATE` direto nas colunas de status.

## As seis categorias de checagem

1. Juridiquês em excesso
2. Tom que aponta culpados/responsáveis internos
3. Formalismo fora do padrão
4. Ruído e informação desnecessária
5. Caso do cliente tratado de forma genérica (contexto de negócio — assíncrona)
6. Cláusulas ausentes no modelo aprovado (comparação estrutural, não desmarcada por
   padrão na Tela 1 — ver `detectarClausulasAusentes` em `src/lib/rules/estilo/motor.ts`)

## Papéis e permissões

Aplicados via Row Level Security (`supabase/migrations/20260917091200_rls_policies.sql`)
e, para as regras mais específicas, dentro das próprias funções de negócio:

- **Sócio** — vê tudo, aprova/pede ajuste/corrige, promove modelos, confirma reconciliação,
  pode atribuir a autoria de uma minuta a qualquer advogado/estagiário (upload
  administrativo).
- **Advogado** — sobe minutas, aplica sugestões, vê as próprias minutas e as de qualquer
  estagiário (para poder aprovar o envio delas ao sócio), e também pode atribuir a
  autoria a outro advogado ou estagiário.
- **Estagiário** — sobe minutas só em nome de si mesmo e aplica sugestões nelas; a
  transição "enviar ao sócio" exige um advogado ou o sócio.

## Configuração

1. Copie `.env.example` para `.env.local` e preencha com um projeto Supabase real (a
   organização já tem um: **Painel de Revisão de Contratos**).
2. Aplique as migrações:
   ```bash
   npx supabase link --project-ref <ref-do-projeto>
   npx supabase db push
   ```
   (ou `npx supabase start` localmente, se tiver Docker — aí as migrações e o seed rodam
   sozinhos.)
3. Crie os usuários (sócio/advogados/estagiário) pela API Admin do Supabase ou pelo
   Studio — o trigger `handle_novo_usuario` preenche `usuarios` sozinho a partir de
   `raw_user_meta_data.perfil`. Ver a lista de nomes no fim de `supabase/seed.sql`.
4. `npm install && npm run dev`, depois entre em `/login`.

### Variáveis de ambiente

Ver `.env.example`. Além das credenciais do Supabase:

- `JOBS_WORKER_SECRET` — segredo que um agendador externo (Vercel Cron, cron do
  Supabase) envia em `Authorization: Bearer <segredo>` para acionar
  `POST /api/jobs/contexto-cliente`, que processa a fila da categoria 5.
- `GOOGLE_DRIVE_CLIENT_EMAIL` / `GOOGLE_DRIVE_PRIVATE_KEY` / `GOOGLE_DRIVE_PLANEJAMENTO_PATRIMONIAL_FOLDER_ID`
  — conta de serviço do Google com leitura na árvore de planejamento patrimonial e
  sucessório (é lá que os clientes aparecem nomeados).
- `CLICKUP_API_TOKEN` / `CLICKUP_WORKSPACE_ID` — leitura da base de clientes/demandas.

## Rodando localmente

```bash
npm run dev              # servidor Next.js
npm test                 # testes unitários (motor de regras, extração, heurísticas)
npm run validar:schema   # aplica todas as migrações (+ seed) num Postgres in-process (PGlite)
npm run testar:fluxo     # ciclo de vida completo do documento + checagem de RLS por papel
```

Não há Docker neste ambiente de desenvolvimento, então `scripts/` usa
[PGlite](https://pglite.dev) para validar SQL e regras de permissão sem depender do
Supabase CLI local. Isso não substitui testar contra um projeto Supabase real antes de ir
para produção, mas já pega a maioria dos erros de sintaxe, de referência entre tabelas e
de RLS mal configurada — e foi assim que dois bugs reais de offset (sinalização aplicada
guardando as coordenadas antigas em vez das novas) e um de alinhamento de cláusulas
apareceram durante o desenvolvimento.

## Design

A UI segue o design canvas entregue pelo escritório: sistema "blueprint" (fundo bege,
quadros com cantos de registro, tipografia Archivo, azul-marinho #102B4E como acor da
marca). Tokens e classes de componente (`.btn`, `.field`, `.tag`, `.table`, `.dialog`,
`.blueprint`) em `src/app/globals.css`. As cores por categoria de sinalização (incluindo a
6ª, criada depois do desenho original) estão centralizadas em `src/lib/categorias.ts`.

Duas peças não existiam no mockup (que simula um único documento com dados fixos) e foram
criadas para o sistema funcionar com documentos de verdade: a tela de **login**
(`src/app/login`) e a **lista de documentos** (`src/app/(painel)/documentos`), usada como
hub para entrar em qualquer minuta específica nas Telas 2/3.

## Como funciona a checagem (Tela 2)

1. **Categorias 1, 2, 3, 4 e 6 (estilo)** rodam **síncronas**, assim que o documento entra
   em `em_checagem`: `src/lib/rules/estilo/motor.ts` aplica os padrões (regex,
   "qualificação do preâmbulo repetida", ou comparação estrutural com o modelo) das
   `regras_estilo` ativas e grava as sinalizações via `src/lib/services/checagem.ts`.
2. **Categoria 5 (caso do cliente genérico)** é **assíncrona**: a mesma requisição
   enfileira um job em `analises_contexto_cliente_jobs`; um worker externo chama
   `POST /api/jobs/contexto-cliente` (protegido por `JOBS_WORKER_SECRET`), que roda
   `src/lib/rules/contexto-cliente/heuristicas.ts` cruzando a minuta com
   `clientes`/`cliente_contratos_anteriores` e notifica o autor quando termina.
3. **Aplicar um ajuste** substitui o trecho em `texto_trabalho` e desloca os offsets de
   toda sinalização pendente que vem depois — isso é feito dentro da transação da função
   `resolver_sinalizacao`/`aplicar_sinalizacoes_em_lote`, nunca no cliente. O offset da
   própria sinalização aplicada também é recalculado para delimitar o texto novo.

## Pontos que exigem julgamento humano (Tela 3)

`src/lib/services/pontos-julgamento-humano.ts` classifica cada ponto pendente em três
razões (decisão comercial — teto de responsabilidade/foro/prazo —, contradição entre o
histórico do cliente e o modelo, ou conflito entre regras do guia) e anexa o contexto que
fundamenta a decisão: o que o modelo diz, o que os contratos anteriores daquele cliente
fizeram (com contagem de ocorrências), ou as duas orientações que se conflitam. Clicar num
trecho destacado na Tela 3 abre a correção direta para aquele trecho específico.

## Limitações conhecidas / próximos passos

- O projeto Supabase real (**Painel de Revisão de Contratos**) ainda não recebeu as
  migrações — isso e a criação dos usuários de teste ficaram para outra sessão.
- Os clientes de Google Drive e ClickUp (`src/lib/integrations`) estão implementados
  contra as APIs REST reais, mas não foram exercitados contra credenciais de verdade
  neste ambiente — vale um teste de integração assim que houver uma conta de serviço e
  um token de workspace configurados.
- `src/types/database.types.ts` foi escrito à mão para refletir as migrações. Assim que
  o projeto Supabase estiver linkado, regenere com
  `npx supabase gen types typescript --linked` e reconcilie com os comentários de negócio
  que já estão nas interfaces atuais.
- Upload/download de arquivo original passam pelo bucket privado `minutas-originais` via
  service role (nunca direto do cliente) — ver `supabase/migrations/20260917091500_storage.sql`.
- "Corrigir diretamente" (Tela 3) hoje só edita trechos já destacados (resolvidos ou
  pendentes de julgamento) — editar texto arbitrário fora de qualquer marca ainda não
  tem uma interação própria.
