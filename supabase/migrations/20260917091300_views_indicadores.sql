-- Views de agregação para a Tela 4 (Histórico e perfil da equipe). RLS das tabelas
-- de origem já filtra o que cada usuário pode ver; estas views herdam esse filtro
-- porque são "security_invoker" (rodam com o papel de quem consulta).

-- Duração de cada passagem pelo sócio: do momento em que o documento entra em
-- "aguardando_socio" até a próxima transição (aprovado ou em_ajuste_pela_equipe).
create view vw_tempo_revisao_por_passagem
with (security_invoker = true) as
select
  t.documento_id,
  t.id as transicao_id,
  t.criado_em as entrou_em,
  lead(t.criado_em) over (partition by t.documento_id order by t.criado_em) as saiu_em,
  lead(t.status_novo) over (partition by t.documento_id order by t.criado_em) as status_seguinte
from documento_transicoes t
where t.status_novo = 'aguardando_socio';

create view vw_tempo_revisao_concluida
with (security_invoker = true) as
select documento_id, transicao_id, entrou_em, saiu_em, (saiu_em - entrou_em) as duracao
from vw_tempo_revisao_por_passagem
where saiu_em is not null;

-- Indicadores gerais do escritório (cartões no topo da Tela 4).
create view vw_indicadores_gerais
with (security_invoker = true) as
select
  (select count(*) from documentos where status = 'aprovado') as minutas_aprovadas,
  (select count(distinct documento_id) from documento_transicoes where status_novo = 'aguardando_socio') as minutas_revisadas_pelo_socio,
  (select count(*) from correcoes) as total_correcoes_socio,
  (select categoria from correcoes where categoria is not null group by categoria order by count(*) desc limit 1) as desvio_mais_comum,
  (select avg(duracao) from vw_tempo_revisao_concluida) as tempo_medio_revisao;

-- Perfil por integrante: volume, correções, média por minuta.
-- Restrição explícita de "vê apenas o próprio perfil" (advogado e estagiário só
-- enxergam a própria linha; a visibilidade mais ampla de "usuarios" para fins de
-- listagem de documentos não vale aqui, de propósito).
create view vw_perfil_usuario
with (security_invoker = true) as
select
  u.id as usuario_id,
  u.nome,
  u.perfil,
  (select count(*) from documentos d where d.autor_id = u.id) as volume_minutas,
  (select count(*) from correcoes c where c.autor_minuta_id = u.id) as total_correcoes,
  case
    when (select count(*) from documentos d where d.autor_id = u.id) = 0 then 0
    else round(
      (select count(*)::numeric from correcoes c where c.autor_minuta_id = u.id)
      / (select count(*) from documentos d where d.autor_id = u.id),
      2
    )
  end as media_correcoes_por_minuta
from usuarios u
where u.id = auth.uid() or usuario_atual_e_socio();

-- Categorias de erro mais recorrentes por integrante, em ordem de frequência.
-- Inclui explicitamente "ruido_informacao_desnecessaria" e "caso_cliente_generico"
-- (categorias citadas à parte no requisito, mas que já vêm naturalmente desta view
-- por serem valores normais de "categoria").
create view vw_perfil_usuario_categoria
with (security_invoker = true) as
select
  c.autor_minuta_id as usuario_id,
  c.categoria,
  count(*) as total,
  rank() over (partition by c.autor_minuta_id order by count(*) desc) as posicao
from correcoes c
where c.categoria is not null
  and (c.autor_minuta_id = auth.uid() or usuario_atual_e_socio())
group by c.autor_minuta_id, c.categoria;

-- Evolução mensal: mostra se o padrão de cada integrante está melhorando ou piorando,
-- não só o acumulado.
create view vw_perfil_usuario_evolucao_mensal
with (security_invoker = true) as
select
  c.autor_minuta_id as usuario_id,
  date_trunc('month', c.criado_em)::date as mes,
  c.categoria,
  count(*) as total
from correcoes c
where c.autor_minuta_id = auth.uid() or usuario_atual_e_socio()
group by c.autor_minuta_id, date_trunc('month', c.criado_em), c.categoria;

comment on view vw_perfil_usuario_evolucao_mensal is 'Base para o gráfico de evolução no perfil de cada integrante: total de correções por mês e categoria.';
