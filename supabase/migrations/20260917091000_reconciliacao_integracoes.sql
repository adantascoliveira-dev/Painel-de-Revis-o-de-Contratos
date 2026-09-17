-- Tela de reconciliação: Google Drive e ClickUp trazem listas de clientes
-- inconsistentes entre si, então nada vira "clientes" direto — passa por aqui até
-- o sócio confirmar o cadastro canônico.

create table fontes_reconciliacao (
  id uuid primary key default gen_random_uuid(),
  cliente_candidato_nome text not null,
  fonte fonte_reconciliacao not null,
  referencia_externa_id text not null, -- id da pasta no Drive ou do cliente/lista no ClickUp
  dados_brutos jsonb not null default '{}'::jsonb, -- payload bruto lido da fonte, para auditoria/depuração
  cliente_id_sugerido uuid references clientes (id), -- melhor match automático (nome + trigram)
  similaridade numeric(4, 3), -- 0..1, score do match sugerido
  status status_reconciliacao not null default 'pendente',
  cliente_id_confirmado uuid references clientes (id),
  confirmado_por uuid references usuarios (id),
  confirmado_em timestamptz,
  criado_em timestamptz not null default now(),

  constraint fontes_reconciliacao_origem_unica unique (fonte, referencia_externa_id),

  constraint fontes_reconciliacao_confirmacao_coerente check (
    (status in ('confirmado', 'mesclado') and confirmado_por is not null and confirmado_em is not null and cliente_id_confirmado is not null)
    or (status in ('pendente', 'descartado'))
  )
);

comment on table fontes_reconciliacao is 'Candidatos a cliente lidos do Drive/ClickUp. status=confirmado liga a um cliente existente ou recém-criado; status=mesclado indica que foi unificado a outro candidato; status=descartado é ruído da fonte (ex.: pasta de teste). Nunca alimenta a base de clientes sozinho.';

create index idx_fontes_reconciliacao_status on fontes_reconciliacao (status, criado_em);
create index idx_fontes_reconciliacao_nome_trgm on fontes_reconciliacao using gin (cliente_candidato_nome gin_trgm_ops);

create or replace function verificar_confirmador_e_socio()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.confirmado_por is not null
     and not exists (select 1 from usuarios where id = new.confirmado_por and perfil = 'socio') then
    raise exception 'Só um sócio pode confirmar o cadastro canônico na reconciliação.';
  end if;
  return new;
end;
$$;

create trigger trg_fontes_reconciliacao_confirmador_e_socio
  before insert or update of confirmado_por on fontes_reconciliacao
  for each row execute function verificar_confirmador_e_socio();
