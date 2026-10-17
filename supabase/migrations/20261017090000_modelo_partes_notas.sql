-- "Nota para a equipe" dos modelos (orientação interna) fica fora do texto das cláusulas:
-- se ficasse dentro, a sugestão de "cláusula ausente" colaria a nota dentro do contrato.
alter table modelo_partes drop constraint modelo_partes_tipo_check;
alter table modelo_partes add constraint modelo_partes_tipo_check check (tipo in ('modulo_condicional', 'anexo', 'nota'));
