-- Sugestão automática de match para a tela de reconciliação, via similaridade
-- trigram (pg_trgm) entre o nome candidato (vindo do Drive/ClickUp) e os
-- clientes já cadastrados. O sócio ainda confirma manualmente — isto é só a
-- sugestão inicial exibida na tela.
create or replace function sugerir_cliente_por_nome(p_nome text, p_limiar real default 0.3)
returns table (cliente_id uuid, similaridade real)
language sql
stable
security definer set search_path = public
as $$
  select id, similarity(nome, p_nome)
    from clientes
   where ativo and similarity(nome, p_nome) >= p_limiar
   order by similarity(nome, p_nome) desc
   limit 1;
$$;
