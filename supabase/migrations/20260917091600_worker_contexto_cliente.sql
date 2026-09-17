-- Reivindicação atômica do próximo job da fila de contexto do cliente. Usa
-- FOR UPDATE SKIP LOCKED para que múltiplas invocações concorrentes do worker
-- (ex.: dois disparos de cron sobrepostos) nunca processem o mesmo job em duplicidade.
create or replace function reivindicar_proximo_job_contexto_cliente()
returns analises_contexto_cliente_jobs
language plpgsql
security definer set search_path = public
as $$
declare
  v_job analises_contexto_cliente_jobs;
begin
  select * into v_job
    from analises_contexto_cliente_jobs
   where status = 'pendente'
   order by criado_em asc
   for update skip locked
   limit 1;

  if v_job.id is null then
    return null;
  end if;

  update analises_contexto_cliente_jobs
     set status = 'processando', iniciado_em = now(), tentativas = tentativas + 1
   where id = v_job.id
   returning * into v_job;

  return v_job;
end;
$$;

create or replace function concluir_job_contexto_cliente(p_job_id uuid, p_resultado_resumo jsonb)
returns void
language sql
security definer set search_path = public
as $$
  update analises_contexto_cliente_jobs
     set status = 'concluido', concluido_em = now(), resultado_resumo = p_resultado_resumo
   where id = p_job_id;
$$;

create or replace function falhar_job_contexto_cliente(p_job_id uuid, p_erro text)
returns void
language sql
security definer set search_path = public
as $$
  update analises_contexto_cliente_jobs
     set status = 'erro', concluido_em = now(), erro = p_erro
   where id = p_job_id;
$$;
