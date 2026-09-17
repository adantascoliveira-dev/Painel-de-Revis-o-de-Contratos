-- Perfis internos do escritório, espelhando auth.users com o papel de cada integrante.

create table usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null,
  perfil perfil_usuario not null default 'estagiario',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table usuarios is 'Integrantes do escritório e seu papel (sócio, advogado, estagiário).';

create trigger trg_usuarios_atualizado_em
  before update on usuarios
  for each row execute function set_atualizado_em();

-- Um novo usuário do Supabase Auth ganha automaticamente uma linha em "usuarios".
-- O perfil pode ser passado em raw_user_meta_data->>'perfil' no convite/cadastro
-- (fluxo típico: o sócio convida a pessoa já indicando o papel); na ausência disso,
-- o padrão é o papel de menor privilégio (estagiário), promovido depois por um sócio.
create or replace function handle_novo_usuario()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into usuarios (id, nome, email, perfil)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'perfil')::perfil_usuario, 'estagiario')
  );
  return new;
end;
$$;

create trigger trg_auth_users_novo_usuario
  after insert on auth.users
  for each row execute function handle_novo_usuario();

-- Helpers usados por praticamente todas as políticas de RLS do schema.
create or replace function perfil_do_usuario_atual()
returns perfil_usuario
language sql
stable
security definer set search_path = public
as $$
  select perfil from usuarios where id = auth.uid();
$$;

create or replace function usuario_atual_e_socio()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select perfil = 'socio' from usuarios where id = auth.uid()), false);
$$;

create or replace function usuario_atual_e_advogado_ou_socio()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select perfil in ('advogado', 'socio') from usuarios where id = auth.uid()), false);
$$;
