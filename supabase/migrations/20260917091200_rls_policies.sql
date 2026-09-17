-- Row Level Security para todo o schema. Mutações sensíveis (status de documento,
-- resolução de sinalização, correção, promoção a modelo, reconciliação) não têm
-- política de UPDATE/INSERT direta: só acontecem através das funções SECURITY
-- DEFINER da migração anterior, que fazem sua própria checagem de permissão.

-- Helper: a mesma regra de visibilidade de documento é reaproveitada nas tabelas
-- dependentes (transições, snapshots, sinalizações, correções, jobs).
create or replace function usuario_pode_ver_documento(p_documento_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from documentos d
    join usuarios autor on autor.id = d.autor_id
    where d.id = p_documento_id
      and (
        usuario_atual_e_socio()
        or d.autor_id = auth.uid()
        or d.socio_revisor_id = auth.uid()
        or (perfil_do_usuario_atual() = 'advogado' and autor.perfil = 'estagiario')
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- usuarios
-- ---------------------------------------------------------------------------
alter table usuarios enable row level security;

-- Sócio é sempre visível a todo mundo (necessário para o seletor de "sócio
-- responsável pela revisão" na Tela 1). Advogado enxerga outros advogados e
-- estagiários (necessário para atribuir a autoria de uma minuta a outra pessoa).
create policy usuarios_select on usuarios for select
  using (
    id = auth.uid()
    or usuario_atual_e_socio()
    or perfil = 'socio'
    or (perfil_do_usuario_atual() = 'advogado' and perfil in ('advogado', 'estagiario'))
  );

create policy usuarios_update on usuarios for update
  using (id = auth.uid() or usuario_atual_e_socio())
  with check (id = auth.uid() or usuario_atual_e_socio());

-- Ninguém além de um sócio pode mudar o próprio papel ou se reativar/desativar.
create or replace function impedir_auto_promocao()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if perfil_do_usuario_atual() <> 'socio'
     and (new.perfil is distinct from old.perfil or new.ativo is distinct from old.ativo) then
    raise exception 'Só um sócio pode alterar papel ou ativação de um usuário.';
  end if;
  return new;
end;
$$;

create trigger trg_usuarios_impedir_auto_promocao
  before update on usuarios
  for each row execute function impedir_auto_promocao();

-- ---------------------------------------------------------------------------
-- tipos_peca
-- ---------------------------------------------------------------------------
alter table tipos_peca enable row level security;

create policy tipos_peca_select on tipos_peca for select using (true);
create policy tipos_peca_write on tipos_peca for all
  using (usuario_atual_e_socio())
  with check (usuario_atual_e_socio());

-- ---------------------------------------------------------------------------
-- clientes
-- ---------------------------------------------------------------------------
alter table clientes enable row level security;

create policy clientes_select on clientes for select using (true);

create policy clientes_write on clientes for insert
  with check (usuario_atual_e_advogado_ou_socio());

create policy clientes_update on clientes for update
  using (usuario_atual_e_advogado_ou_socio())
  with check (usuario_atual_e_advogado_ou_socio());

-- ---------------------------------------------------------------------------
-- cliente_contratos_anteriores
-- ---------------------------------------------------------------------------
alter table cliente_contratos_anteriores enable row level security;

create policy contratos_anteriores_select on cliente_contratos_anteriores for select using (true);

create policy contratos_anteriores_write on cliente_contratos_anteriores for insert
  with check (usuario_atual_e_advogado_ou_socio());

create policy contratos_anteriores_update on cliente_contratos_anteriores for update
  using (usuario_atual_e_advogado_ou_socio())
  with check (usuario_atual_e_advogado_ou_socio());

create policy contratos_anteriores_delete on cliente_contratos_anteriores for delete
  using (usuario_atual_e_advogado_ou_socio());

-- ---------------------------------------------------------------------------
-- guias_estilo / regras_estilo
-- ---------------------------------------------------------------------------
alter table guias_estilo enable row level security;
alter table regras_estilo enable row level security;

create policy guias_estilo_select on guias_estilo for select using (true);
create policy guias_estilo_write on guias_estilo for all
  using (usuario_atual_e_socio())
  with check (usuario_atual_e_socio());

create policy regras_estilo_select on regras_estilo for select using (true);
create policy regras_estilo_write on regras_estilo for all
  using (usuario_atual_e_socio())
  with check (usuario_atual_e_socio());

-- ---------------------------------------------------------------------------
-- modelos_aprovados (escrita só via promover_documento_a_modelo, SECURITY DEFINER)
-- ---------------------------------------------------------------------------
alter table modelos_aprovados enable row level security;

create policy modelos_aprovados_select on modelos_aprovados for select using (true);

-- ---------------------------------------------------------------------------
-- documentos (mudança de status/texto só via funções SECURITY DEFINER)
-- ---------------------------------------------------------------------------
alter table documentos enable row level security;

create policy documentos_select on documentos for select
  using (
    usuario_atual_e_socio()
    or autor_id = auth.uid()
    or socio_revisor_id = auth.uid()
    or (
      perfil_do_usuario_atual() = 'advogado'
      and exists (select 1 from usuarios a where a.id = documentos.autor_id and a.perfil = 'estagiario')
    )
  );

-- Estagiário só sobe em nome de si mesmo. Advogado ou sócio podem atribuir a
-- autoria a qualquer advogado ou estagiário (upload administrativo em nome de
-- quem de fato escreveu a minuta) — nunca a um sócio, que não autora minutas.
create policy documentos_insert on documentos for insert
  with check (
    status = 'rascunho'
    and (
      (perfil_do_usuario_atual() = 'estagiario' and autor_id = auth.uid())
      or (
        perfil_do_usuario_atual() in ('advogado', 'socio')
        and exists (select 1 from usuarios a where a.id = autor_id and a.perfil in ('advogado', 'estagiario'))
      )
    )
  );

-- ---------------------------------------------------------------------------
-- documento_transicoes / documento_snapshots (somente leitura via API; imutáveis)
-- ---------------------------------------------------------------------------
alter table documento_transicoes enable row level security;
alter table documento_snapshots enable row level security;

create policy documento_transicoes_select on documento_transicoes for select
  using (usuario_pode_ver_documento(documento_id));

create policy documento_snapshots_select on documento_snapshots for select
  using (usuario_pode_ver_documento(documento_id));

-- ---------------------------------------------------------------------------
-- sinalizacoes (geradas pelo motor de regras via service role; resolvidas via RPC)
-- ---------------------------------------------------------------------------
alter table sinalizacoes enable row level security;

create policy sinalizacoes_select on sinalizacoes for select
  using (usuario_pode_ver_documento(documento_id));

-- ---------------------------------------------------------------------------
-- correcoes (só INSERT via corrigir_diretamente; leitura é a base dos perfis)
-- ---------------------------------------------------------------------------
alter table correcoes enable row level security;

create policy correcoes_select on correcoes for select
  using (usuario_atual_e_socio() or autor_minuta_id = auth.uid());

-- ---------------------------------------------------------------------------
-- perfil_observacoes
-- ---------------------------------------------------------------------------
alter table perfil_observacoes enable row level security;

create policy perfil_observacoes_select on perfil_observacoes for select
  using (usuario_atual_e_socio() or usuario_id = auth.uid());

create policy perfil_observacoes_write on perfil_observacoes for insert
  with check (usuario_atual_e_socio());

create policy perfil_observacoes_update on perfil_observacoes for update
  using (usuario_atual_e_socio())
  with check (usuario_atual_e_socio());

create policy perfil_observacoes_delete on perfil_observacoes for delete
  using (usuario_atual_e_socio());

-- ---------------------------------------------------------------------------
-- analises_contexto_cliente_jobs (enfileirar é permitido; processar é o worker)
-- ---------------------------------------------------------------------------
alter table analises_contexto_cliente_jobs enable row level security;

create policy analises_contexto_jobs_select on analises_contexto_cliente_jobs for select
  using (usuario_pode_ver_documento(documento_id));

create policy analises_contexto_jobs_insert on analises_contexto_cliente_jobs for insert
  with check (usuario_pode_ver_documento(documento_id));

-- ---------------------------------------------------------------------------
-- notificacoes
-- ---------------------------------------------------------------------------
alter table notificacoes enable row level security;

create policy notificacoes_select on notificacoes for select using (usuario_id = auth.uid());

create policy notificacoes_update on notificacoes for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create or replace function impedir_alteracao_notificacao_alem_de_lida()
returns trigger
language plpgsql
as $$
begin
  if new.titulo is distinct from old.titulo
     or new.corpo is distinct from old.corpo
     or new.tipo is distinct from old.tipo
     or new.usuario_id is distinct from old.usuario_id
     or new.documento_id is distinct from old.documento_id then
    raise exception 'Só o campo "lida" de uma notificação pode ser alterado pelo destinatário.';
  end if;
  return new;
end;
$$;

create trigger trg_notificacoes_apenas_lida
  before update on notificacoes
  for each row execute function impedir_alteracao_notificacao_alem_de_lida();

-- ---------------------------------------------------------------------------
-- fontes_reconciliacao (escrita de status só via confirmar_reconciliacao)
-- ---------------------------------------------------------------------------
alter table fontes_reconciliacao enable row level security;

create policy fontes_reconciliacao_select on fontes_reconciliacao for select
  using (usuario_atual_e_advogado_ou_socio());
