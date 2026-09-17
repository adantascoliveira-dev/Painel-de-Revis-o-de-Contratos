-- Hardening apontado pelo advisor de segurança do Supabase após a criação do schema:
--
-- 1) search_path fixo nas funções que ainda não tinham (mitiga search_path hijacking).
--
-- 2) Funções "privadas" (prefixo "_"), funções de trigger e as funções do worker de
--    contexto do cliente eram, por padrão do Postgres/PostgREST, executáveis via RPC
--    por qualquer usuário anon/authenticated — mesmo não fazendo sentido como
--    endpoint público. O caso mais sério é _aplicar_texto_em_documento: ela reescreve
--    o texto_trabalho de qualquer documento e não faz nenhum checked de permissão
--    (quem checa é sempre a função "pública" que a chama, ex.: resolver_sinalizacao),
--    então deixá-la exposta permitiria qualquer usuário autenticado reescrever a
--    minuta de qualquer outra pessoa. As três funções do worker de contexto do
--    cliente só são chamadas pelo endpoint /api/jobs/contexto-cliente com a service
--    role (ver src/lib/supabase/admin.ts) e nunca pelo client do navegador.
--
-- Revogar de "public" remove o acesso tanto de "anon" quanto de "authenticated"
-- (que herdam dela); as funções continuam funcionando normalmente quando chamadas
-- de dentro de outra função SECURITY DEFINER (o dono das funções, não o role que
-- fez a chamada original, é quem precisa de privilégio nesse caso) e continuam
-- acessíveis à service_role, que tem privilégio amplo por padrão no Supabase.

alter function set_atualizado_em() set search_path = public;
alter function _pode_atuar_no_documento(documentos, usuarios) set search_path = public;
alter function bloquear_alteracao_registro_imutavel() set search_path = public;
alter function pedir_ajuste_equipe(uuid, text, date) set search_path = public;
alter function aprovar_documento(uuid) set search_path = public;
alter function impedir_alteracao_notificacao_alem_de_lida() set search_path = public;

revoke execute on function set_atualizado_em() from public;
revoke execute on function handle_novo_usuario() from public;
revoke execute on function impedir_auto_promocao() from public;
revoke execute on function verificar_aprovador_e_socio() from public;
revoke execute on function verificar_revisor_e_socio() from public;
revoke execute on function verificar_corretor_e_socio() from public;
revoke execute on function verificar_autor_observacao_e_socio() from public;
revoke execute on function verificar_confirmador_e_socio() from public;
revoke execute on function bloquear_alteracao_registro_imutavel() from public;
revoke execute on function impedir_alteracao_notificacao_alem_de_lida() from public;
revoke execute on function _apos_criar_documento() from public;
revoke execute on function _pode_atuar_no_documento(documentos, usuarios) from public;
revoke execute on function _aplicar_texto_em_documento(uuid, integer, integer, text, uuid, text, uuid) from public;
revoke execute on function concluir_job_contexto_cliente(uuid, jsonb) from public;
revoke execute on function falhar_job_contexto_cliente(uuid, text) from public;
revoke execute on function reivindicar_proximo_job_contexto_cliente() from public;

grant execute on function concluir_job_contexto_cliente(uuid, jsonb) to service_role;
grant execute on function falhar_job_contexto_cliente(uuid, text) to service_role;
grant execute on function reivindicar_proximo_job_contexto_cliente() to service_role;
