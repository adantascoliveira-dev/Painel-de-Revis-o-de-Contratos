-- Modelos aprovados do escritório: a régua contra a qual toda minuta nova é comparada.

create table modelos_aprovados (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique, -- ex.: 'MOD-PC-011'
  tipo_peca_id uuid not null references tipos_peca (id),
  cliente_id uuid references clientes (id), -- nulo = modelo genérico do tipo de peça
  texto text not null,
  -- clausulas: [{"numero": "3.2", "titulo": "...", "texto": "...", "offset_inicio": 120, "offset_fim": 340}]
  clausulas jsonb not null default '[]'::jsonb,
  documento_origem_id uuid, -- referência adicionada depois que "documentos" existir (ver migração seguinte)
  guia_estilo_id uuid not null references guias_estilo (id),
  aprovado_por uuid not null references usuarios (id),
  aprovado_em timestamptz not null default now(),
  versao integer not null default 1,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

comment on table modelos_aprovados is 'Só o sócio promove um documento aprovado a modelo (ver trigger e política de RLS). cliente_id nulo = modelo genérico do tipo de peça.';

create index idx_modelos_aprovados_tipo_cliente on modelos_aprovados (tipo_peca_id, cliente_id) where ativo;

-- Reforça no banco, independente da camada de API, que só um sócio pode figurar
-- como aprovador de um modelo.
create or replace function verificar_aprovador_e_socio()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from usuarios where id = new.aprovado_por and perfil = 'socio') then
    raise exception 'Somente um sócio pode aprovar um modelo (aprovado_por deve ter perfil socio).';
  end if;
  return new;
end;
$$;

create trigger trg_modelos_aprovados_aprovador_e_socio
  before insert or update of aprovado_por on modelos_aprovados
  for each row execute function verificar_aprovador_e_socio();
