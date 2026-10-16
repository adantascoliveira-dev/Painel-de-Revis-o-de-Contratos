-- Base de conhecimento do painel: fichas validadas pelo escritório que dizem qual é a
-- posição em cada tipo de contrato. Três camadas, com precedência:
--   escopo 'tipo'        ficha por TIPO DE PEÇA + SUBTIPO + POLO do cliente
--   escopo 'cliente'     exceções de um cliente recorrente; PREVALECE sobre a ficha por tipo
--   escopo 'transversal' alertas que valem para todas as fichas de um tipo de peça
-- O conteúdo fica em markdown (o formato em que as fichas são redigidas e validadas),
-- e só entra na análise quando está ativo e validado (validada_em preenchido).

create table fichas_conhecimento (
  id uuid primary key default gen_random_uuid(),
  escopo text not null check (escopo in ('tipo', 'cliente', 'transversal')),
  titulo text not null,
  tipo_peca_id uuid references tipos_peca (id),
  subtipo text,
  polo text,
  cliente_id uuid references clientes (id),
  conteudo_md text not null,
  validada_por uuid references usuarios (id),
  validada_em date,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint fichas_tipo_exige_tipo_peca check (escopo <> 'tipo' or (tipo_peca_id is not null and cliente_id is null)),
  constraint fichas_cliente_exige_cliente check (escopo <> 'cliente' or cliente_id is not null),
  constraint fichas_transversal_exige_tipo_peca check (escopo <> 'transversal' or (tipo_peca_id is not null and cliente_id is null))
);

comment on table fichas_conhecimento is 'Fichas validadas (markdown) que orientam a análise de minutas. Só fichas ativas e com validada_em preenchido são usadas.';
comment on column fichas_conhecimento.polo is 'Lado do cliente na peça (ex.: locador, locatário, contratante). Texto livre, igual ao informado em documentos.polo.';

create unique index uq_fichas_tipo_ativa
  on fichas_conhecimento (tipo_peca_id, coalesce(subtipo, ''), coalesce(polo, ''))
  where escopo = 'tipo' and ativa;

create unique index uq_fichas_cliente_ativa
  on fichas_conhecimento (cliente_id, coalesce(tipo_peca_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(subtipo, ''), coalesce(polo, ''))
  where escopo = 'cliente' and ativa;

create index idx_fichas_tipo_peca on fichas_conhecimento (tipo_peca_id) where ativa;
create index idx_fichas_cliente on fichas_conhecimento (cliente_id) where ativa;

create trigger trg_fichas_conhecimento_atualizado_em
  before update on fichas_conhecimento
  for each row execute function set_atualizado_em();

alter table fichas_conhecimento enable row level security;

create policy fichas_conhecimento_select on fichas_conhecimento for select using (true);
create policy fichas_conhecimento_insert on fichas_conhecimento for insert with check (usuario_atual_e_socio());
create policy fichas_conhecimento_update on fichas_conhecimento for update
  using (usuario_atual_e_socio()) with check (usuario_atual_e_socio());
create policy fichas_conhecimento_delete on fichas_conhecimento for delete using (usuario_atual_e_socio());

-- Qual ficha por tipo se aplica a uma minuta: tipo de peça + subtipo + polo escolhidos no envio.
alter table documentos add column subtipo text;
alter table documentos add column polo text;
