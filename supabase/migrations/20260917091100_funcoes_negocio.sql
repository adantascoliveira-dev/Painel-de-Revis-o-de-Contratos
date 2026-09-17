-- Funções de negócio (RPC via supabase-js .rpc()) que concentram as regras de
-- fluxo de estado, permissão e edição de texto. Mutações sensíveis (status,
-- aplicação de sinalização, correção direta) passam por aqui em vez de updates
-- diretos de tabela, para que a trilha de auditoria nunca possa ser contornada.

create or replace function usuario_atual()
returns usuarios
language sql
stable
security definer set search_path = public
as $$
  select * from usuarios where id = auth.uid();
$$;

create or replace function _pode_atuar_no_documento(p_documento documentos, p_actor usuarios)
returns boolean
language sql
stable
as $$
  select p_actor.perfil = 'socio'
    or p_actor.id = p_documento.autor_id
    or p_actor.perfil = 'advogado';
$$;

-- ---------------------------------------------------------------------------
-- Edição de texto com ajuste de offsets: toda vez que um trecho [offset_inicio,
-- offset_fim) do texto de trabalho é substituído, as sinalizações pendentes que
-- vêm depois desse trecho precisam ter seus próprios offsets deslocados na mesma
-- medida, senão passam a apontar para o lugar errado do texto.
-- ---------------------------------------------------------------------------
create or replace function _aplicar_texto_em_documento(
  p_documento_id uuid,
  p_offset_inicio integer,
  p_offset_fim integer,
  p_texto_novo text,
  p_actor_id uuid,
  p_motivo text,
  p_transicao_id uuid default null
)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_texto_atual text;
  v_texto_final text;
  v_delta integer;
begin
  select texto_trabalho into v_texto_atual from documentos where id = p_documento_id for update;

  if v_texto_atual is null then
    raise exception 'Documento % não encontrado.', p_documento_id;
  end if;

  -- offset_fim = offset_inicio é uma inserção pura (ex.: cláusula ausente do modelo).
  if p_offset_inicio < 0 or p_offset_fim > length(v_texto_atual) or p_offset_fim < p_offset_inicio then
    raise exception 'Offsets inválidos para o texto atual do documento (inicio=%, fim=%, tamanho=%).',
      p_offset_inicio, p_offset_fim, length(v_texto_atual);
  end if;

  v_texto_final := left(v_texto_atual, p_offset_inicio) || p_texto_novo || substring(v_texto_atual from p_offset_fim + 1);
  v_delta := length(p_texto_novo) - (p_offset_fim - p_offset_inicio);

  update documentos set texto_trabalho = v_texto_final where id = p_documento_id;

  if v_delta <> 0 then
    update sinalizacoes
       set offset_inicio = offset_inicio + v_delta,
           offset_fim = offset_fim + v_delta
     where documento_id = p_documento_id
       and resolucao = 'pendente'
       and offset_inicio >= p_offset_fim;
  end if;

  insert into documento_snapshots (documento_id, texto_trabalho, motivo, transicao_id, criado_por)
  values (p_documento_id, v_texto_final, p_motivo, p_transicao_id, p_actor_id);

  return v_texto_final;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sinalizações: aplicar ajuste, manter redação, ou editar a sugestão antes de aplicar.
-- ---------------------------------------------------------------------------
create or replace function resolver_sinalizacao(
  p_sinalizacao_id uuid,
  p_resolucao resolucao_sinalizacao,
  p_texto_editado text default null
)
returns sinalizacoes
language plpgsql
security definer set search_path = public
as $$
declare
  v_sinalizacao sinalizacoes;
  v_documento documentos;
  v_actor usuarios;
  v_texto_final text;
begin
  select * into v_actor from usuario_atual();
  if v_actor.id is null then
    raise exception 'Usuário autenticado não encontrado.';
  end if;

  if p_resolucao not in ('aplicada', 'mantida') then
    raise exception 'resolucao deve ser aplicada ou mantida.';
  end if;

  select * into v_sinalizacao from sinalizacoes where id = p_sinalizacao_id for update;
  if v_sinalizacao.id is null then
    raise exception 'Sinalização % não encontrada.', p_sinalizacao_id;
  end if;
  if v_sinalizacao.resolucao <> 'pendente' then
    raise exception 'Sinalização já foi resolvida.';
  end if;

  select * into v_documento from documentos where id = v_sinalizacao.documento_id;

  if not _pode_atuar_no_documento(v_documento, v_actor) then
    raise exception 'Usuário sem permissão para resolver sinalizações deste documento.';
  end if;

  if p_resolucao = 'aplicada' then
    v_texto_final := coalesce(p_texto_editado, v_sinalizacao.sugestao_ajuste);
    perform _aplicar_texto_em_documento(
      v_documento.id,
      v_sinalizacao.offset_inicio,
      v_sinalizacao.offset_fim,
      v_texto_final,
      v_actor.id,
      case when p_texto_editado is not null then 'edicao_sinalizacao' else 'aplicacao_sinalizacao' end
    );
  end if;

  -- offset_fim da própria sinalização precisa refletir o texto que passou a
  -- ocupar aquele espaço (pode ter um tamanho diferente do trecho original) —
  -- sem isso, o destaque de "resolvido" na revisão final aponta para o lugar
  -- errado do texto depois de aplicado.
  update sinalizacoes
     set resolucao = p_resolucao,
         resolvido_por = v_actor.id,
         resolvido_em = now(),
         texto_sugestao_editado = p_texto_editado,
         offset_fim = case when p_resolucao = 'aplicada' then offset_inicio + length(v_texto_final) else offset_fim end
   where id = p_sinalizacao_id
   returning * into v_sinalizacao;

  return v_sinalizacao;
end;
$$;

-- "Ação em lote para aplicar todos os desvios de estilo" (categorias 1-4). Processa
-- da esquerda para a direita, sempre relendo os offsets mais recentes, para que o
-- deslocamento causado por uma aplicação não invalide as próximas.
create or replace function aplicar_sinalizacoes_em_lote(p_documento_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_documento documentos;
  v_actor usuarios;
  v_proxima record;
  v_total integer := 0;
begin
  select * into v_actor from usuario_atual();
  select * into v_documento from documentos where id = p_documento_id for update;
  if v_documento.id is null then
    raise exception 'Documento % não encontrado.', p_documento_id;
  end if;
  if not _pode_atuar_no_documento(v_documento, v_actor) then
    raise exception 'Usuário sem permissão para aplicar sinalizações deste documento.';
  end if;

  loop
    select id, offset_inicio, offset_fim, coalesce(texto_sugestao_editado, sugestao_ajuste) as texto_final
      into v_proxima
      from sinalizacoes
     where documento_id = p_documento_id
       and natureza = 'estilo'
       and resolucao = 'pendente'
     order by offset_inicio asc
     limit 1;

    exit when not found;

    perform _aplicar_texto_em_documento(
      p_documento_id, v_proxima.offset_inicio, v_proxima.offset_fim, v_proxima.texto_final, v_actor.id, 'aplicacao_sinalizacao'
    );

    -- offset_fim precisa refletir o texto que passou a ocupar aquele espaço
    -- (mesma razão do ajuste em resolver_sinalizacao).
    update sinalizacoes
       set resolucao = 'aplicada', resolvido_por = v_actor.id, resolvido_em = now(),
           offset_fim = offset_inicio + length(v_proxima.texto_final)
     where id = v_proxima.id;

    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

-- ---------------------------------------------------------------------------
-- Máquina de estados do documento. Único ponto de escrita de documentos.status.
-- ---------------------------------------------------------------------------
create or replace function transicionar_documento_status(
  p_documento_id uuid,
  p_status_novo status_documento,
  p_observacao text default null,
  p_prazo date default null
)
returns documentos
language plpgsql
security definer set search_path = public
as $$
declare
  v_documento documentos;
  v_actor usuarios;
  v_autor usuarios;
  v_transicao_id uuid;
  v_permitido boolean := false;
begin
  select * into v_actor from usuario_atual();
  if v_actor.id is null or not v_actor.ativo then
    raise exception 'Usuário autenticado inválido ou inativo.';
  end if;

  select * into v_documento from documentos where id = p_documento_id for update;
  if v_documento.id is null then
    raise exception 'Documento % não encontrado.', p_documento_id;
  end if;

  select * into v_autor from usuarios where id = v_documento.autor_id;

  if v_documento.status = 'rascunho' and p_status_novo = 'em_checagem' then
    v_permitido := v_actor.id = v_documento.autor_id or v_actor.perfil in ('advogado', 'socio');

  elsif v_documento.status = 'em_checagem' and p_status_novo = 'aguardando_socio' then
    if v_autor.perfil = 'estagiario' then
      v_permitido := v_actor.perfil in ('advogado', 'socio');
    else
      v_permitido := v_actor.id = v_documento.autor_id or v_actor.perfil = 'socio';
    end if;

  elsif v_documento.status = 'aguardando_socio' and p_status_novo = 'em_ajuste_pela_equipe' then
    v_permitido := v_actor.perfil = 'socio' and v_actor.id = v_documento.socio_revisor_id;
    if v_permitido and (p_observacao is null or btrim(p_observacao) = '' or p_prazo is null) then
      raise exception 'Pedir ajuste à equipe exige observação e prazo.';
    end if;

  elsif v_documento.status = 'aguardando_socio' and p_status_novo = 'aprovado' then
    v_permitido := v_actor.perfil = 'socio' and v_actor.id = v_documento.socio_revisor_id;

  elsif v_documento.status = 'em_ajuste_pela_equipe' and p_status_novo = 'em_checagem' then
    v_permitido := v_actor.id = v_documento.autor_id or v_actor.perfil in ('advogado', 'socio');
    if v_permitido then
      update documentos set versao = versao + 1 where id = p_documento_id;
    end if;

  else
    raise exception 'Transição de % para % não é permitida.', v_documento.status, p_status_novo;
  end if;

  if not v_permitido then
    raise exception 'Usuário % (perfil %) não tem permissão para esta transição.', v_actor.id, v_actor.perfil;
  end if;

  update documentos set status = p_status_novo where id = p_documento_id;

  insert into documento_transicoes (documento_id, status_anterior, status_novo, autor_id, observacao, prazo)
  values (p_documento_id, v_documento.status, p_status_novo, v_actor.id, p_observacao, p_prazo)
  returning id into v_transicao_id;

  insert into documento_snapshots (documento_id, texto_trabalho, motivo, transicao_id, criado_por)
  select p_documento_id, texto_trabalho, 'transicao_status', v_transicao_id, v_actor.id
    from documentos where id = p_documento_id;

  if p_status_novo = 'aguardando_socio' then
    insert into notificacoes (usuario_id, documento_id, tipo, titulo, corpo)
    values (v_documento.socio_revisor_id, p_documento_id, 'documento_aguardando_socio',
      'Minuta aguardando sua revisão', format('"%s" está pronta para revisão final.', v_documento.titulo));
  elsif p_status_novo = 'em_ajuste_pela_equipe' then
    insert into notificacoes (usuario_id, documento_id, tipo, titulo, corpo)
    values (v_documento.autor_id, p_documento_id, 'pedido_ajuste_equipe',
      'Ajuste solicitado pelo sócio', coalesce(p_observacao, ''));
  elsif p_status_novo = 'aprovado' then
    insert into notificacoes (usuario_id, documento_id, tipo, titulo, corpo)
    values (v_documento.autor_id, p_documento_id, 'documento_aprovado',
      'Minuta aprovada', format('"%s" foi aprovada e sua versão foi congelada.', v_documento.titulo));
  end if;

  select * into v_documento from documentos where id = p_documento_id;
  return v_documento;
end;
$$;

-- Ao criar um documento (insert simples, controlado por RLS), gera automaticamente
-- a primeira transição (null -> rascunho) e o snapshot inicial.
create or replace function _apos_criar_documento()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status <> 'rascunho' then
    raise exception 'Todo documento deve nascer com status rascunho.';
  end if;

  insert into documento_transicoes (documento_id, status_anterior, status_novo, autor_id)
  values (new.id, null, 'rascunho', new.autor_id);

  insert into documento_snapshots (documento_id, texto_trabalho, motivo, criado_por)
  values (new.id, new.texto_trabalho, 'criacao', new.autor_id);

  return new;
end;
$$;

create trigger trg_documentos_apos_criar
  after insert on documentos
  for each row execute function _apos_criar_documento();

-- ---------------------------------------------------------------------------
-- Revisão final (Tela 3): aprovar, pedir ajuste, corrigir diretamente.
-- ---------------------------------------------------------------------------
create or replace function pedir_ajuste_equipe(p_documento_id uuid, p_observacao text, p_prazo date)
returns documentos
language sql
as $$
  select transicionar_documento_status(p_documento_id, 'em_ajuste_pela_equipe', p_observacao, p_prazo);
$$;

create or replace function aprovar_documento(p_documento_id uuid)
returns documentos
language sql
as $$
  select transicionar_documento_status(p_documento_id, 'aprovado');
$$;

create or replace function corrigir_diretamente(
  p_documento_id uuid,
  p_offset_inicio integer,
  p_offset_fim integer,
  p_texto_antes text,
  p_texto_depois text,
  p_clausula_numero text default null,
  p_categoria categoria_sinalizacao default null,
  p_sinalizacao_origem_id uuid default null
)
returns correcoes
language plpgsql
security definer set search_path = public
as $$
declare
  v_documento documentos;
  v_actor usuarios;
  v_correcao correcoes;
begin
  select * into v_actor from usuario_atual();
  select * into v_documento from documentos where id = p_documento_id for update;

  if v_documento.id is null then
    raise exception 'Documento % não encontrado.', p_documento_id;
  end if;
  if v_actor.perfil <> 'socio' or v_actor.id <> v_documento.socio_revisor_id then
    raise exception 'Só o sócio designado para revisar este documento pode corrigir diretamente.';
  end if;
  if v_documento.status <> 'aguardando_socio' then
    raise exception 'Correção direta só é permitida durante a revisão final (status aguardando_socio).';
  end if;

  perform _aplicar_texto_em_documento(
    p_documento_id, p_offset_inicio, p_offset_fim, p_texto_depois, v_actor.id, 'correcao_direta'
  );

  if p_sinalizacao_origem_id is not null then
    -- offset_fim precisa refletir p_texto_depois (pode ter tamanho diferente
    -- do trecho original) — mesma razão do ajuste em resolver_sinalizacao.
    update sinalizacoes
       set resolucao = 'aplicada', resolvido_por = v_actor.id, resolvido_em = now(),
           offset_fim = p_offset_inicio + length(p_texto_depois)
     where id = p_sinalizacao_origem_id and resolucao = 'pendente';
  end if;

  insert into correcoes (
    documento_id, autor_minuta_id, corrigido_por, categoria, clausula_numero,
    texto_antes, texto_depois, sinalizacao_origem_id
  ) values (
    p_documento_id, v_documento.autor_id, v_actor.id, p_categoria, p_clausula_numero,
    p_texto_antes, p_texto_depois, p_sinalizacao_origem_id
  ) returning * into v_correcao;

  return v_correcao;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seleção automática de modelo (Tela 1) e promoção de documento a modelo (Tela 3).
-- ---------------------------------------------------------------------------
create or replace function selecionar_melhor_modelo(p_tipo_peca_id uuid, p_cliente_id uuid)
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select id from (
    select
      m.id,
      m.aprovado_em,
      case
        when m.cliente_id = p_cliente_id then 0
        when m.cliente_id in (
          select c2.id from clientes c2
          where c2.tipo = (select tipo from clientes where id = p_cliente_id) and c2.id <> p_cliente_id
        ) then 1
        when m.cliente_id is null then 2
        else 99
      end as prioridade
    from modelos_aprovados m
    where m.tipo_peca_id = p_tipo_peca_id and m.ativo
  ) candidatos
  where prioridade < 99
  order by prioridade asc, aprovado_em desc
  limit 1;
$$;

create or replace function promover_documento_a_modelo(
  p_documento_id uuid,
  p_codigo text,
  p_clausulas jsonb,
  p_generico boolean default false
)
returns modelos_aprovados
language plpgsql
security definer set search_path = public
as $$
declare
  v_documento documentos;
  v_actor usuarios;
  v_guia_ativo uuid;
  v_modelo modelos_aprovados;
begin
  select * into v_actor from usuario_atual();
  if v_actor.perfil <> 'socio' then
    raise exception 'Só o sócio promove um documento aprovado a modelo.';
  end if;

  select * into v_documento from documentos where id = p_documento_id;
  if v_documento.status <> 'aprovado' then
    raise exception 'Só é possível promover a modelo um documento já aprovado.';
  end if;

  select id into v_guia_ativo from guias_estilo where ativo limit 1;

  insert into modelos_aprovados (
    codigo, tipo_peca_id, cliente_id, texto, clausulas, documento_origem_id, guia_estilo_id, aprovado_por
  ) values (
    p_codigo,
    v_documento.tipo_peca_id,
    case when p_generico then null else v_documento.cliente_id end,
    v_documento.texto_trabalho,
    p_clausulas,
    v_documento.id,
    v_guia_ativo,
    v_actor.id
  ) returning * into v_modelo;

  return v_modelo;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reconciliação (Google Drive + ClickUp): o sócio confirma o cadastro canônico.
-- ---------------------------------------------------------------------------
create or replace function confirmar_reconciliacao(
  p_fonte_id uuid,
  p_cliente_id uuid default null,
  p_novo_cliente jsonb default null,
  p_status status_reconciliacao default 'confirmado'
)
returns fontes_reconciliacao
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor usuarios;
  v_fonte fontes_reconciliacao;
  v_cliente_id uuid;
begin
  select * into v_actor from usuario_atual();
  if v_actor.perfil <> 'socio' then
    raise exception 'Só o sócio confirma o cadastro canônico na reconciliação.';
  end if;

  select * into v_fonte from fontes_reconciliacao where id = p_fonte_id for update;
  if v_fonte.id is null then
    raise exception 'Registro de reconciliação % não encontrado.', p_fonte_id;
  end if;

  if p_status = 'descartado' then
    update fontes_reconciliacao set status = 'descartado' where id = p_fonte_id returning * into v_fonte;
    return v_fonte;
  end if;

  if p_cliente_id is not null then
    v_cliente_id := p_cliente_id;
  elsif p_novo_cliente is not null then
    insert into clientes (nome, tipo, documento_identificacao, estrutura_societaria, notas_operacao, preferencias_negociadas)
    values (
      p_novo_cliente ->> 'nome',
      (p_novo_cliente ->> 'tipo')::tipo_cliente,
      p_novo_cliente ->> 'documento_identificacao',
      coalesce(p_novo_cliente -> 'estrutura_societaria', '{}'::jsonb),
      p_novo_cliente ->> 'notas_operacao',
      coalesce(p_novo_cliente -> 'preferencias_negociadas', '{}'::jsonb)
    ) returning id into v_cliente_id;
  else
    raise exception 'Informe cliente_id (para vincular a um cliente existente) ou novo_cliente (para criar um).';
  end if;

  if v_fonte.fonte = 'google_drive' then
    update clientes set google_drive_folder_id = v_fonte.referencia_externa_id where id = v_cliente_id;
  elsif v_fonte.fonte = 'clickup' then
    update clientes set clickup_client_id = v_fonte.referencia_externa_id where id = v_cliente_id;
  end if;

  update fontes_reconciliacao
     set status = p_status, cliente_id_confirmado = v_cliente_id, confirmado_por = v_actor.id, confirmado_em = now()
   where id = p_fonte_id
   returning * into v_fonte;

  return v_fonte;
end;
$$;
