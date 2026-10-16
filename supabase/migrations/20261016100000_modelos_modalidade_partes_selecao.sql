-- Modelos aprovados passam a ter modalidade (ex.: pontual x contínuo), partes acessórias
-- (módulos condicionais e anexos) e uma regra de seleção que respeita o POP-CIV-011:
-- modelo vinculado a um cliente só vale para esse cliente; para os demais, só modelo genérico.

alter table modelos_aprovados add column modalidade text check (modalidade in ('pontual', 'continuo'));
alter table documentos add column modalidade text check (modalidade in ('pontual', 'continuo'));

comment on column modelos_aprovados.modalidade is 'Nulo = vale para qualquer modalidade. Preenchido: só é escolhido para minutas da mesma modalidade.';
comment on column documentos.modalidade is 'Identificada pelo texto da minuta quando o tipo de peça tem modelos por modalidade; nulo = não identificada ou não se aplica.';

-- Partes que acompanham um modelo sem fazer parte do corpo comparado cláusula a cláusula:
--   modulo_condicional: só vale quando a condição descrita se verifica (nunca gera "cláusula ausente");
--   anexo: documento que acompanha o contrato (ex.: protocolo de gestão), opcionalmente exportado junto.
create table modelo_partes (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references modelos_aprovados (id) on delete cascade,
  tipo text not null check (tipo in ('modulo_condicional', 'anexo')),
  codigo text not null,
  titulo text not null,
  condicao text,
  texto text not null,
  incluir_na_exportacao boolean not null default false,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  unique (modelo_id, codigo),
  constraint modelo_partes_modulo_tem_condicao check (tipo <> 'modulo_condicional' or condicao is not null)
);

create index idx_modelo_partes_modelo on modelo_partes (modelo_id, ordem);

alter table modelo_partes enable row level security;
create policy modelo_partes_select on modelo_partes for select using (true);
create policy modelo_partes_insert on modelo_partes for insert with check (usuario_atual_e_socio());
create policy modelo_partes_update on modelo_partes for update using (usuario_atual_e_socio()) with check (usuario_atual_e_socio());
create policy modelo_partes_delete on modelo_partes for delete using (usuario_atual_e_socio());

-- Seleção do modelo de uma minuta: o do próprio cliente, se houver; senão o genérico (sem cliente).
-- Nunca o modelo de outro cliente. Com modalidade: modelo por modalidade só vale para a mesma;
-- modelo sem modalidade vale para qualquer. Nulo = sem modelo aprovado (só checagens de estilo e ficha).
drop function if exists selecionar_melhor_modelo(uuid, uuid);

create or replace function selecionar_melhor_modelo(p_tipo_peca_id uuid, p_cliente_id uuid, p_modalidade text default null)
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select m.id
    from modelos_aprovados m
   where m.tipo_peca_id = p_tipo_peca_id
     and m.ativo
     and (m.cliente_id = p_cliente_id or m.cliente_id is null)
     and (m.modalidade is null or m.modalidade = p_modalidade)
   order by (m.cliente_id is not null) desc, m.aprovado_em desc
   limit 1;
$$;
