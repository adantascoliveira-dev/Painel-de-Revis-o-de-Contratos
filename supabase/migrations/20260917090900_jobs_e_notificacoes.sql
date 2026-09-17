-- Fila de análise assíncrona de contexto do cliente (categoria 5) e notificações
-- geradas pelo sistema. A análise de estilo (categorias 1-4) é síncrona e não
-- precisa de fila; só a de contexto, que depende de cruzar histórico, é assíncrona.

create table analises_contexto_cliente_jobs (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references documentos (id) on delete cascade,
  status status_job not null default 'pendente',
  tentativas integer not null default 0,
  erro text,
  resultado_resumo jsonb, -- ex.: {"sinalizacoes_geradas": 3, "duracao_ms": 4200}
  criado_em timestamptz not null default now(),
  iniciado_em timestamptz,
  concluido_em timestamptz
);

comment on table analises_contexto_cliente_jobs is 'Fila processada por /api/jobs/contexto-cliente (worker endpoint chamado por um agendador externo). Um documento pode ter mais de um job ao longo do tempo (reprocessamento após correção de cadastro do cliente, por exemplo).';

create index idx_analises_contexto_cliente_jobs_status on analises_contexto_cliente_jobs (status, criado_em);
create index idx_analises_contexto_cliente_jobs_documento on analises_contexto_cliente_jobs (documento_id);

create table notificacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios (id) on delete cascade,
  documento_id uuid references documentos (id) on delete cascade,
  tipo text not null check (tipo in (
    'analise_contexto_concluida',
    'documento_aguardando_socio',
    'pedido_ajuste_equipe',
    'documento_aprovado',
    'reconciliacao_pendente'
  )),
  titulo text not null,
  corpo text not null,
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);

comment on table notificacoes is 'Notificações in-app. A análise de contexto do cliente notifica aqui quando termina, já que roda assíncrona.';

create index idx_notificacoes_usuario on notificacoes (usuario_id, lida, criado_em desc);
