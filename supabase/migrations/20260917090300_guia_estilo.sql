-- Guia de estilo do escritório, versionado. Trocar de versão não reprocessa documentos
-- já aprovados: cada modelo aprovado grava a versão do guia vigente no momento (ver
-- modelos_aprovados.guia_estilo_id) e cada sinalização grava a regra exata que a gerou.

create table guias_estilo (
  id uuid primary key default gen_random_uuid(),
  versao text not null unique, -- ex.: 'v4'
  vigente_desde date not null default current_date,
  ativo boolean not null default false,
  criado_em timestamptz not null default now()
);

comment on table guias_estilo is 'Versões do guia de estilo. No máximo uma versão ativa por vez.';

-- Garante que só existe uma versão "ativa" (vigente) por vez.
create unique index idx_guias_estilo_uma_ativa on guias_estilo (ativo) where ativo;

create table regras_estilo (
  id uuid primary key default gen_random_uuid(),
  guia_estilo_id uuid not null references guias_estilo (id) on delete cascade,
  categoria categoria_sinalizacao not null,
  nome text not null,
  -- padrao_deteccao descreve como o motor de regras (ver src/lib/rules) reconhece o
  -- desvio. Formato: {"tipo": "regex" | "regex_lista" | "similaridade_preambulo",
  -- "padroes": ["..."], "flags": "gi"}
  padrao_deteccao jsonb not null,
  texto_orientacao text not null,
  exemplo_antes text,
  exemplo_depois text,
  severidade_default severidade_sinalizacao not null default 'media',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint regras_estilo_categoria_nao_e_contexto_cliente
    check (categoria <> 'caso_cliente_generico')
);

comment on table regras_estilo is 'Regras de detecção do guia de estilo para as categorias 1-4 (a categoria 5, caso do cliente, roda com lógica própria de cruzamento de dados e não usa esta tabela).';

create index idx_regras_estilo_guia_categoria on regras_estilo (guia_estilo_id, categoria) where ativo;
