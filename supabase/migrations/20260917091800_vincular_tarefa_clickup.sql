-- Vincula (ou desvincula, passando null) a minuta à sua task no ClickUp. Mesma
-- regra de quem pode mexer no documento usada em resolver_sinalizacao/etc.
create or replace function vincular_tarefa_clickup(p_documento_id uuid, p_clickup_task_id text)
returns documentos
language plpgsql
security definer set search_path = public
as $$
declare
  v_documento documentos;
  v_actor usuarios;
begin
  select * into v_actor from usuario_atual();
  select * into v_documento from documentos where id = p_documento_id for update;
  if v_documento.id is null then
    raise exception 'Documento % não encontrado.', p_documento_id;
  end if;
  if not _pode_atuar_no_documento(v_documento, v_actor) then
    raise exception 'Usuário sem permissão para vincular a task do ClickUp a este documento.';
  end if;

  update documentos set clickup_task_id = p_clickup_task_id where id = p_documento_id
  returning * into v_documento;

  return v_documento;
end;
$$;
