-- Núcleo do sistema: o documento (minuta) em si, sua trilha de transições de status
-- (auditoria imutável) e os snapshots de texto que garantem versionamento completo.

create table documentos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,

  arquivo_original_path text, -- caminho no Supabase Storage; nulo quando foi colagem de texto puro
  arquivo_original_nome text,
  arquivo_original_mime text,
  arquivo_original_tamanho_bytes integer,

  texto_extraido text not null, -- texto como veio da extração/colagem, nunca é reescrito
  texto_trabalho text not null, -- texto de trabalho onde os ajustes da checagem/revisão são aplicados
  clausulas jsonb not null default '[]'::jsonb, -- [{"numero": "3.2", "titulo": "...", "offset_inicio": 0, "offset_fim": 0}]

  tipo_peca_id uuid not null references tipos_peca (id),
  cliente_id uuid not null references clientes (id),
  autor_id uuid not null references usuarios (id),
  socio_revisor_id uuid not null references usuarios (id),
  modelo_aprovado_id uuid references modelos_aprovados (id),

  status status_documento not null default 'rascunho',
  versao integer not null default 1,
  documento_pai_id uuid references documentos (id), -- versão anterior, quando esta nasceu de um "pedir ajuste"

  categorias_checagem_habilitadas jsonb not null default
    '["juridiques_excesso","tom_culpa","formalismo_fora_padrao","ruido_informacao_desnecessaria","caso_cliente_generico"]'::jsonb,

  clickup_task_id text,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint documentos_tamanho_max_20mb check (
    arquivo_original_tamanho_bytes is null or arquivo_original_tamanho_bytes <= 20971520
  )
);

comment on table documentos is 'Uma minuta e seu estado atual. Novas versões (após "pedir ajuste à equipe") são novas linhas encadeadas por documento_pai_id, nunca um update destrutivo do texto anterior.';

create index idx_documentos_cliente on documentos (cliente_id);
create index idx_documentos_autor on documentos (autor_id);
create index idx_documentos_socio_revisor on documentos (socio_revisor_id);
create index idx_documentos_status on documentos (status);
create index idx_documentos_pai on documentos (documento_pai_id);

create trigger trg_documentos_atualizado_em
  before update on documentos
  for each row execute function set_atualizado_em();

-- socio_revisor_id sempre precisa apontar para um usuário com perfil "socio".
create or replace function verificar_revisor_e_socio()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from usuarios where id = new.socio_revisor_id and perfil = 'socio') then
    raise exception 'socio_revisor_id deve apontar para um usuário com perfil socio.';
  end if;
  return new;
end;
$$;

create trigger trg_documentos_revisor_e_socio
  before insert or update of socio_revisor_id on documentos
  for each row execute function verificar_revisor_e_socio();

-- Agora que "documentos" existe, fecha a referência circular com modelos_aprovados.
alter table modelos_aprovados
  add constraint fk_modelos_aprovados_documento_origem
  foreign key (documento_origem_id) references documentos (id);

-- Trilha de auditoria imutável: toda transição de status vira uma linha aqui,
-- nunca é editada ou apagada (ver trigger de bloqueio mais abaixo).
create table documento_transicoes (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references documentos (id) on delete cascade,
  status_anterior status_documento,
  status_novo status_documento not null,
  autor_id uuid not null references usuarios (id),
  observacao text,
  prazo date, -- usado em "pedir ajuste à equipe"
  criado_em timestamptz not null default now()
);

comment on table documento_transicoes is 'Trilha de auditoria imutável de mudanças de status. Toda escrita passa pela função transicionar_documento_status (ver migração de funções de negócio).';

create index idx_documento_transicoes_documento on documento_transicoes (documento_id, criado_em);

create or replace function bloquear_alteracao_registro_imutavel()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Registros de % são imutáveis e não podem ser alterados ou apagados.', tg_table_name;
end;
$$;

create trigger trg_documento_transicoes_imutavel_update
  before update on documento_transicoes
  for each row execute function bloquear_alteracao_registro_imutavel();

create trigger trg_documento_transicoes_imutavel_delete
  before delete on documento_transicoes
  for each row execute function bloquear_alteracao_registro_imutavel();

-- Snapshots do texto de trabalho: garantem que qualquer versão intermediária
-- (não só as versões "oficiais" ligadas por documento_pai_id) seja recuperável.
create table documento_snapshots (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references documentos (id) on delete cascade,
  texto_trabalho text not null,
  motivo text not null check (motivo in (
    'criacao', 'transicao_status', 'aplicacao_sinalizacao', 'edicao_sinalizacao', 'correcao_direta'
  )),
  transicao_id uuid references documento_transicoes (id),
  criado_por uuid not null references usuarios (id),
  criado_em timestamptz not null default now()
);

comment on table documento_snapshots is 'Versionamento completo do texto de trabalho: cada mudança relevante grava uma cópia integral, nunca só o diff.';

create index idx_documento_snapshots_documento on documento_snapshots (documento_id, criado_em);

create trigger trg_documento_snapshots_imutavel_update
  before update on documento_snapshots
  for each row execute function bloquear_alteracao_registro_imutavel();

create trigger trg_documento_snapshots_imutavel_delete
  before delete on documento_snapshots
  for each row execute function bloquear_alteracao_registro_imutavel();
