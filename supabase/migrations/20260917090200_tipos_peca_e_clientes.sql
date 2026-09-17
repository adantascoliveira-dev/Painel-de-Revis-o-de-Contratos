-- Tipos de peça que o escritório produz e cadastro canônico de clientes.

create table tipos_peca (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  grupo text, -- rótulo do optgroup na Tela 1 (ex.: "Societário e patrimonial"); só exibição
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

comment on table tipos_peca is 'Catálogo de tipos de peça (contrato social de holding, acordo de sócios, etc.), mantido como tabela em vez de enum para permitir novos tipos sem migração.';

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo tipo_cliente not null,
  documento_identificacao text, -- CNPJ ou CPF
  estrutura_societaria jsonb not null default '{}'::jsonb,
  notas_operacao text,
  -- preferências negociadas: teto_responsabilidade, foro, prazo_sigilo_minimo_meses,
  -- trava_incessibilidade, dados_comerciais_sensiveis, remuneracao_por_volume, etc.
  preferencias_negociadas jsonb not null default '{}'::jsonb,
  google_drive_folder_id text,
  clickup_client_id text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table clientes is 'Cadastro canônico de clientes. Entradas vindas do Drive/ClickUp só chegam aqui depois de confirmadas na tela de reconciliação (ver fontes_reconciliacao).';
comment on column clientes.preferencias_negociadas is 'Ex.: {"teto_responsabilidade": "...", "foro": "...", "prazo_sigilo_minimo_meses": 24, "trava_incessibilidade": true, "dados_comerciais_sensiveis": true, "remuneracao_por_volume": true, "percentual_socios_pj": 0.7}';

create index idx_clientes_nome_trgm on clientes using gin (nome gin_trgm_ops);
create unique index idx_clientes_google_drive_folder_id on clientes (google_drive_folder_id) where google_drive_folder_id is not null;
create unique index idx_clientes_clickup_client_id on clientes (clickup_client_id) where clickup_client_id is not null;

create trigger trg_clientes_atualizado_em
  before update on clientes
  for each row execute function set_atualizado_em();
