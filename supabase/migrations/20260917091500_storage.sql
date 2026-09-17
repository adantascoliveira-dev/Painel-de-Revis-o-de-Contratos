-- Bucket privado para os arquivos originais das minutas. Não é acessado direto
-- pelo cliente: upload, download e geração de URL assinada acontecem sempre
-- pelas rotas server-side (service role), que primeiro checam autorização contra
-- a tabela "usuarios" e a visibilidade do documento. Por isso não há políticas de
-- RLS em storage.objects para este bucket — o acesso direto via API do Supabase
-- fica fechado por padrão (bucket privado, sem policy = sem acesso).
insert into storage.buckets (id, name, public, file_size_limit)
values ('minutas-originais', 'minutas-originais', false, 20971520)
on conflict (id) do nothing;
