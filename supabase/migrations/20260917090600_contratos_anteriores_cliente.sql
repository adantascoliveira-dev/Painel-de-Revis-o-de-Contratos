-- Histórico contratual de cada cliente: matéria-prima da checagem de categoria 5
-- (caso do cliente tratado de forma genérica), que cruza a minuta nova com o que
-- já foi negociado antes para aquele cliente específico.

create table cliente_contratos_anteriores (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  tipo_peca_id uuid not null references tipos_peca (id),
  documento_id uuid references documentos (id), -- preenchido quando o próprio contrato passou pelo sistema
  fonte text not null check (fonte in ('google_drive', 'sistema', 'manual')),
  referencia_externa text, -- ex.: id do arquivo no Google Drive
  -- resumo_clausulas: extração estruturada usada pelas heurísticas de contexto do
  -- cliente, ex.: {"teto_responsabilidade": "...", "foro": "...",
  -- "prazo_sigilo_meses": 24, "trava_incessibilidade": true,
  -- "responsabilidade_pessoal_socios": false, "remuneracao_por_volume": true}
  resumo_clausulas jsonb not null default '{}'::jsonb,
  data_documento date,
  criado_em timestamptz not null default now()
);

comment on table cliente_contratos_anteriores is 'Cada apontamento de categoria 5 (caso_cliente_generico) deve citar a fonte da inferência; esta tabela é uma das fontes possíveis (junto de clientes.estrutura_societaria/preferencias_negociadas e clausulas de modelos_aprovados).';

create index idx_contratos_anteriores_cliente on cliente_contratos_anteriores (cliente_id, tipo_peca_id);
