-- Extensões e tipos enumerados usados em todo o schema do Painel de Revisão de Minutas.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm; -- usado para similaridade de nomes na reconciliação de clientes

create type perfil_usuario as enum ('socio', 'advogado', 'estagiario');

create type tipo_cliente as enum ('holding', 'empresa', 'pessoa_fisica');

create type status_documento as enum (
  'rascunho',
  'em_checagem',
  'aguardando_socio',
  'em_ajuste_pela_equipe',
  'aprovado'
);

-- Categoria 5 (caso do cliente tratado de forma genérica) roda com lógica própria de
-- cruzamento de dados, por isso é sempre 'natureza' = 'contexto_negocio'; as demais são 'estilo'.
-- 'clausulas_ausentes' (6ª, adicionada depois do desenho da Tela 1) compara a estrutura
-- da minuta com a do modelo aprovado — também 'estilo', por ser comparação com o padrão
-- fixo, não com o histórico específico do cliente.
create type categoria_sinalizacao as enum (
  'juridiques_excesso',
  'tom_culpa',
  'formalismo_fora_padrao',
  'ruido_informacao_desnecessaria',
  'caso_cliente_generico',
  'clausulas_ausentes'
);

create type natureza_sinalizacao as enum ('estilo', 'contexto_negocio');

create type severidade_sinalizacao as enum ('baixa', 'media', 'alta');

create type resolucao_sinalizacao as enum ('pendente', 'aplicada', 'mantida');

create type status_job as enum ('pendente', 'processando', 'concluido', 'erro');

create type fonte_reconciliacao as enum ('google_drive', 'clickup', 'manual');

create type status_reconciliacao as enum ('pendente', 'confirmado', 'descartado', 'mesclado');

-- Função utilitária para manter "atualizado_em" em qualquer tabela que a use.
create or replace function set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;
