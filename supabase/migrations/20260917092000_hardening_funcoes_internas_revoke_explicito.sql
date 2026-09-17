-- A migração anterior (20260917091900) revogou EXECUTE de "public", mas o Supabase
-- concede EXECUTE em funções novas do schema "public" diretamente para anon/
-- authenticated/service_role via default privileges do projeto — revogar só de
-- "public" não remove essa concessão direta (confirmado com has_function_privilege:
-- anon/authenticated continuavam com EXECUTE = true mesmo após o revoke anterior).
-- Corrigindo revogando explicitamente dos três roles nomeados.

revoke execute on function set_atualizado_em() from anon, authenticated;
revoke execute on function handle_novo_usuario() from anon, authenticated;
revoke execute on function impedir_auto_promocao() from anon, authenticated;
revoke execute on function verificar_aprovador_e_socio() from anon, authenticated;
revoke execute on function verificar_revisor_e_socio() from anon, authenticated;
revoke execute on function verificar_corretor_e_socio() from anon, authenticated;
revoke execute on function verificar_autor_observacao_e_socio() from anon, authenticated;
revoke execute on function verificar_confirmador_e_socio() from anon, authenticated;
revoke execute on function bloquear_alteracao_registro_imutavel() from anon, authenticated;
revoke execute on function impedir_alteracao_notificacao_alem_de_lida() from anon, authenticated;
revoke execute on function _apos_criar_documento() from anon, authenticated;
revoke execute on function _pode_atuar_no_documento(documentos, usuarios) from anon, authenticated;
revoke execute on function _aplicar_texto_em_documento(uuid, integer, integer, text, uuid, text, uuid) from anon, authenticated;
revoke execute on function concluir_job_contexto_cliente(uuid, jsonb) from anon, authenticated;
revoke execute on function falhar_job_contexto_cliente(uuid, text) from anon, authenticated;
revoke execute on function reivindicar_proximo_job_contexto_cliente() from anon, authenticated;
