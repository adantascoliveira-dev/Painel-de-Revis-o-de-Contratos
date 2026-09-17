-- Cada desvio apontado na tela de comparação/checagem, nas cinco categorias do guia.
-- Estilo (categorias 1-4) e contexto de negócio (categoria 5) ficam na mesma tabela
-- mas são explicitamente separados pela coluna "natureza", pois o usuário decide
-- sobre eles de forma diferente (ver Tela 2 do produto).

create table sinalizacoes (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references documentos (id) on delete cascade,

  clausula_numero text,
  trecho_original text not null,
  offset_inicio integer not null,
  offset_fim integer not null,

  categoria categoria_sinalizacao not null,
  natureza natureza_sinalizacao not null,

  sugestao_ajuste text not null,
  justificativa text not null,
  severidade severidade_sinalizacao not null,

  -- Só preenchido para natureza = 'contexto_negocio': de onde veio a inferência.
  -- {"tipo": "contrato_anterior" | "cadastro_cliente" | "clausula_contrato_social",
  --  "referencia_id": "<uuid da fonte, quando aplicável>", "detalhe": "texto citando a fonte"}
  fonte_inferencia jsonb,

  -- Só preenchido para natureza = 'estilo': qual regra do guia gerou o apontamento.
  regra_estilo_id uuid references regras_estilo (id),

  resolucao resolucao_sinalizacao not null default 'pendente',
  resolvido_por uuid references usuarios (id),
  resolvido_em timestamptz,
  texto_sugestao_editado text, -- preenchido quando o usuário edita a sugestão antes de aplicar

  criado_em timestamptz not null default now(),

  -- offset_fim = offset_inicio é um ponto de inserção (usado por "clausulas_ausentes":
  -- não há trecho a substituir, só um lugar onde a cláusula faltante deveria entrar).
  constraint sinalizacoes_offsets_validos check (offset_fim >= offset_inicio),

  constraint sinalizacoes_natureza_coerente_com_categoria check (
    (categoria = 'caso_cliente_generico' and natureza = 'contexto_negocio')
    or (categoria <> 'caso_cliente_generico' and natureza = 'estilo')
  ),

  constraint sinalizacoes_contexto_negocio_tem_fonte check (
    natureza <> 'contexto_negocio' or fonte_inferencia is not null
  ),

  constraint sinalizacoes_estilo_tem_regra check (
    natureza <> 'estilo' or regra_estilo_id is not null
  ),

  constraint sinalizacoes_resolucao_coerente check (
    (resolucao = 'pendente' and resolvido_por is null and resolvido_em is null)
    or (resolucao <> 'pendente' and resolvido_por is not null and resolvido_em is not null)
  )
);

comment on table sinalizacoes is 'Apontamentos da checagem. natureza=estilo vem do motor de regras do guia (síncrono); natureza=contexto_negocio vem do cruzamento com o cadastro do cliente (assíncrono).';

create index idx_sinalizacoes_documento on sinalizacoes (documento_id);
create index idx_sinalizacoes_documento_natureza on sinalizacoes (documento_id, natureza);
create index idx_sinalizacoes_documento_resolucao on sinalizacoes (documento_id, resolucao);
