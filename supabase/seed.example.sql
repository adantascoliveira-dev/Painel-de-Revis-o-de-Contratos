-- Template de dados de desenvolvimento SEM clientes reais. Copie para seed.sql
-- (gitignored) e substitua pelos clientes reais do escritório, ou use este
-- mesmo arquivo se preferir manter tudo fictício.
--
-- Rodado automaticamente por `supabase db reset` (ver supabase/config.toml,
-- [db.seed] -> sql_paths). Só roda em ambiente local/dev, nunca em produção.

insert into clientes (nome, tipo, preferencias_negociadas, notas_operacao) values
  ('Holding Exemplo Participações', 'holding', '{"trava_incessibilidade": true}'::jsonb, null),
  ('Empresa Exemplo Comércio Ltda', 'empresa', '{"remuneracao_por_volume": true, "percentual_socios_pj": 0.6, "dados_comerciais_sensiveis": true, "prazo_sigilo_minimo_meses": 48}'::jsonb,
    'Opera por agentes credenciados com carteira própria e remuneração por volume.'),
  ('Fulano de Tal', 'pessoa_fisica', '{}'::jsonb, null);

-- Usuários (sócio/advogado/estagiário) não entram aqui: precisam existir em
-- auth.users primeiro. Crie-os pela API Admin do Supabase (supabase.auth.admin.createUser)
-- ou pelo Studio — o trigger handle_novo_usuario cuida do resto (ver
-- supabase/migrations/20260917090100_usuarios.sql). Depois de criados, um
-- modelo_aprovado e um documento de exemplo podem ser inseridos apontando
-- para os ids reais desses usuários.
