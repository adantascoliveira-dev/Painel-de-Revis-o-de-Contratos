-- Correções: o que o sócio efetivamente mudou na revisão final. É a matéria-prima
-- dos perfis da equipe (Tela 4) — por isso sempre aponta para o autor original da minuta,
-- não para quem corrigiu (que é sempre o sócio).

create table correcoes (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references documentos (id) on delete cascade,
  autor_minuta_id uuid not null references usuarios (id),
  corrigido_por uuid not null references usuarios (id),
  categoria categoria_sinalizacao, -- nulo quando a correção não se encaixa em nenhuma categoria do guia
  clausula_numero text,
  texto_antes text not null,
  texto_depois text not null,
  sinalizacao_origem_id uuid references sinalizacoes (id), -- preenchido quando nasce de uma sinalização que ficou pendente
  criado_em timestamptz not null default now()
);

comment on table correcoes is 'Toda correção direta do sócio na revisão final gera um registro aqui, vinculado ao autor da minuta original.';

create index idx_correcoes_autor_minuta on correcoes (autor_minuta_id, criado_em);
create index idx_correcoes_documento on correcoes (documento_id);
create index idx_correcoes_categoria on correcoes (categoria);

create trigger trg_correcoes_imutavel_update
  before update on correcoes
  for each row execute function bloquear_alteracao_registro_imutavel();

create trigger trg_correcoes_imutavel_delete
  before delete on correcoes
  for each row execute function bloquear_alteracao_registro_imutavel();

create or replace function verificar_corretor_e_socio()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from usuarios where id = new.corrigido_por and perfil = 'socio') then
    raise exception 'corrigido_por deve apontar para um usuário com perfil socio (só o sócio corrige diretamente na revisão final).';
  end if;
  return new;
end;
$$;

create trigger trg_correcoes_corretor_e_socio
  before insert on correcoes
  for each row execute function verificar_corretor_e_socio();

-- Observação qualitativa do sócio sobre cada integrante (Tela 4 - Perfil da equipe).
-- Um único texto editável por pessoa, não um log histórico.
create table perfil_observacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null unique references usuarios (id) on delete cascade,
  autor_id uuid not null references usuarios (id),
  texto text not null,
  atualizado_em timestamptz not null default now()
);

comment on table perfil_observacoes is 'Observação qualitativa editável pelo sócio sobre cada integrante da equipe.';

create trigger trg_perfil_observacoes_atualizado_em
  before update on perfil_observacoes
  for each row execute function set_atualizado_em();

create or replace function verificar_autor_observacao_e_socio()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from usuarios where id = new.autor_id and perfil = 'socio') then
    raise exception 'Só um sócio pode escrever a observação qualitativa de um integrante.';
  end if;
  return new;
end;
$$;

create trigger trg_perfil_observacoes_autor_e_socio
  before insert or update of autor_id on perfil_observacoes
  for each row execute function verificar_autor_observacao_e_socio();
