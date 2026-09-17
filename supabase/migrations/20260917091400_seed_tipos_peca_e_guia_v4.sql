-- Dados de referência (não são dados de teste): catálogo de tipos de peça e a
-- versão 4 do guia de estilo do escritório, com as regras das categorias 1-4.
-- A categoria 5 (caso do cliente tratado de forma genérica) não usa regras daqui;
-- roda com lógica própria em src/lib/rules/contexto-cliente.
--
-- padrao_deteccao para regras do tipo "regex_lista" traz, por padrão, além do
-- regex, um "substituto" literal (aceita $1, $2... de grupos capturados) usado
-- pelo motor (src/lib/rules/estilo/motor.ts) para montar a sugestão de ajuste
-- concreta de cada ocorrência — não só a orientação genérica da regra.

insert into tipos_peca (slug, nome, grupo) values
  ('contrato_social_holding_travada', 'Contrato social — holding travada', 'Societário e patrimonial'),
  ('contrato_social_holding_familiar', 'Contrato social — holding familiar', 'Societário e patrimonial'),
  ('acordo_de_socios', 'Acordo de sócios', 'Societário e patrimonial'),
  ('aditivo_contratual', 'Alteração / aditivo de contrato social', 'Societário e patrimonial'),
  ('ata_reuniao_socios', 'Ata de reunião de sócios', 'Societário e patrimonial'),
  ('declaracao_bens_particulares', 'Declaração de bens particulares', 'Societário e patrimonial'),

  ('contrato_prestacao_servicos', 'Contrato de prestação de serviços', 'Contratos empresariais'),
  ('contrato_parceria', 'Contrato de parceria — parceiro credenciado', 'Contratos empresariais'),
  ('contrato_empreitada_terceirizados_obra', 'Contrato de empreitada / terceirizados de obra', 'Contratos empresariais'),
  ('cessao_licenciamento_marca', 'Cessão e licenciamento de marca', 'Contratos empresariais'),

  ('promessa_compra_venda_imovel', 'Promessa de compra e venda de imóvel', 'Imobiliário'),
  ('contrato_locacao_nao_residencial', 'Contrato de locação não residencial', 'Imobiliário'),
  ('declaracao_inexistencia_onus', 'Declaração de inexistência de ônus', 'Imobiliário'),

  ('notificacao_extrajudicial', 'Notificação extrajudicial', 'Contencioso e extrajudicial'),
  ('peticao_civel', 'Petição — cível', 'Contencioso e extrajudicial'),
  ('contrarrazoes_recurso', 'Contrarrazões / recurso', 'Contencioso e extrajudicial');

insert into guias_estilo (versao, vigente_desde, ativo) values ('v4', current_date, true);

-- Categoria 1: juridiquês em excesso.
insert into regras_estilo (guia_estilo_id, categoria, nome, padrao_deteccao, texto_orientacao, exemplo_antes, exemplo_depois, severidade_default)
select id, 'juridiques_excesso', 'Intensificadores e conectores arcaicos',
  '{"tipo": "regex_lista", "flags": "giu", "padroes": [
    {"regex": "\\bdata\\s+venia\\b", "substituto": ""},
    {"regex": "\\bcom\\s+todo\\s+o\\s+respeito\\s+e\\s+acatamento\\s+devidos\\b", "substituto": ""},
    {"regex": "\\boutrossim\\b", "substituto": "além disso"},
    {"regex": "\\bdestarte\\b", "substituto": "assim"},
    {"regex": "\\bde\\s+per\\s+si\\b", "substituto": "por si só"}
  ]}'::jsonb,
  'Substitua intensificadores e conectores arcaicos por linguagem direta: em vez de "outrossim" ou "destarte", use "além disso" ou apenas inicie a próxima frase.',
  'Outrossim, destarte, as partes acordam que...',
  'Além disso, as partes acordam que...',
  'baixa'
from guias_estilo where versao = 'v4';

insert into regras_estilo (guia_estilo_id, categoria, nome, padrao_deteccao, texto_orientacao, exemplo_antes, exemplo_depois, severidade_default)
select id, 'juridiques_excesso', 'Duplas e triplas redundantes',
  '{"tipo": "regex_lista", "flags": "giu", "padroes": [
    {"regex": "(nul[oa])\\s+e\\s+sem\\s+nenhum\\s+efeito\\b", "substituto": "$1"},
    {"regex": "(nul[oa])\\s+e\\s+n[ãa]o\\s+surtir[áa]\\s+efeito\\s+algum\\b", "substituto": "$1"},
    {"regex": "\\bplen[ao]s?,?\\s+geral,?\\s+rasa?\\s+e\\s+irrevog[áa]vel\\s+quita[çc][ãa]o\\b", "substituto": "quitação plena"},
    {"regex": "\\bajustado\\s+e\\s+acordado\\b", "substituto": "ajustado"},
    {"regex": "\\bcombinado\\s+e\\s+acertado\\b", "substituto": "combinado"}
  ]}'::jsonb,
  'Elimine a duplicação: escolha um único termo que já carregue o sentido pretendido.',
  'Fica ajustado e acordado entre as partes que...',
  'Fica ajustado entre as partes que...',
  'baixa'
from guias_estilo where versao = 'v4';

insert into regras_estilo (guia_estilo_id, categoria, nome, padrao_deteccao, texto_orientacao, exemplo_antes, exemplo_depois, severidade_default)
select id, 'juridiques_excesso', 'Vocabulário arcaico',
  '{"tipo": "regex_lista", "flags": "giu", "padroes": [
    {"regex": "retro\\s*mencionad([oa])\\b", "substituto": "mencionad$1 acima"},
    {"regex": "supra\\s*citad([oa])\\b", "substituto": "citad$1 acima"},
    {"regex": "\\bo\\s+quanto\\s+ora\\s+se\\s+alega\\b", "substituto": "o que se alega"},
    {"regex": "\\bhodiernamente\\b", "substituto": "atualmente"},
    {"regex": "\\bderradeiro\\b", "substituto": "último"}
  ]}'::jsonb,
  'Troque o termo arcaico pelo equivalente direto (ex.: "supracitado" -> "mencionado acima", ou repita o termo já usado antes).',
  'O contrato supracitado permanece em vigor.',
  'O contrato mencionado acima permanece em vigor.',
  'baixa'
from guias_estilo where versao = 'v4';

-- Categoria 2: tom que aponta culpados ou responsáveis internos.
insert into regras_estilo (guia_estilo_id, categoria, nome, padrao_deteccao, texto_orientacao, exemplo_antes, exemplo_depois, severidade_default)
select id, 'tom_culpa', 'Atribuição de culpa a pessoa ou área do cliente',
  '{"tipo": "regex_lista", "flags": "giu", "padroes": [
    {"regex": "\\bpor\\s+culpa\\s+exclusiva\\s+d[ao]\\s+(?:setor|departamento|área|diretoria|gerência)\\b", "substituto": "em decorrência de falha operacional"},
    {"regex": "\\bem\\s+raz[ãa]o\\s+da\\s+neglig[êe]ncia\\s+d[ao]\\s+\\w+\\b", "substituto": "em razão de atraso no cumprimento da obrigação"},
    {"regex": "\\bresponsabilidade\\s+única\\s+e\\s+exclusiva\\s+d[eo]\\s+[A-ZÀ-Ú][a-zà-ú]+\\b", "substituto": "responsabilidade pelo evento"},
    {"regex": "\\bfalha\\s+do\\s+(?:setor|departamento|colaborador|funcionário)\\b", "substituto": "falha operacional"}
  ]}'::jsonb,
  'Descreva o fato e a consequência contratual, não quem foi o culpado internamente no cliente. Em vez de nomear o setor ou a pessoa, descreva a situação objetiva que gera o efeito. A sugestão automática é genérica de propósito — ajuste o texto para o fato específico antes de aplicar.',
  'O atraso, por culpa exclusiva do setor financeiro da CONTRATANTE, gerará multa.',
  'O atraso no repasse das informações financeiras gerará multa.',
  'alta'
from guias_estilo where versao = 'v4';

-- Categoria 3: formalismo fora do padrão.
insert into regras_estilo (guia_estilo_id, categoria, nome, padrao_deteccao, texto_orientacao, exemplo_antes, exemplo_depois, severidade_default)
select id, 'formalismo_fora_padrao', 'Latinismos',
  '{"tipo": "regex_lista", "flags": "giu", "padroes": [
    {"regex": "\\bad\\s+cautelam\\b", "substituto": "por precaução"},
    {"regex": "\\bdata\\s+m[aá]xima\\s+venia\\b", "substituto": "com o devido respeito"},
    {"regex": "\\bmutatis\\s+mutandis\\b", "substituto": "com as devidas adaptações"},
    {"regex": "\\bs\\.?\\s?m\\.?\\s?j\\.?\\b", "substituto": ""},
    {"regex": "\\bin\\s+fine\\b", "substituto": "ao final"},
    {"regex": "\\bex\\s+vi\\b", "substituto": "nos termos"}
  ]}'::jsonb,
  'Latinismos não têm lugar em peça contratual do escritório; escreva o sentido em português direto ou remova o termo.',
  'Ad cautelam, esclarece-se que a obrigação subsiste.',
  'Por precaução, esclarece-se que a obrigação subsiste.',
  'media'
from guias_estilo where versao = 'v4';

insert into regras_estilo (guia_estilo_id, categoria, nome, padrao_deteccao, texto_orientacao, exemplo_antes, exemplo_depois, severidade_default)
select id, 'formalismo_fora_padrao', 'Fórmulas de petição em peça contratual',
  '{"tipo": "regex_lista", "flags": "giu", "padroes": [
    {"regex": "\\bnestes\\s+termos,?\\s+pede\\s+deferimento\\b", "substituto": ""},
    {"regex": "\\btermos\\s+em\\s+que,?\\s+pede\\s+e\\s+espera\\s+deferimento\\b", "substituto": ""},
    {"regex": "\\bexcelent[íi]ssim[oa]\\s+senhor[a]?\\b", "substituto": ""}
  ]}'::jsonb,
  'Fórmulas de petição (endereçamento ao juízo, pedido de deferimento) não fazem sentido em um contrato entre partes privadas; remova.',
  'Nestes termos, pede deferimento.',
  '(remover — não se aplica a um contrato entre partes)',
  'alta'
from guias_estilo where versao = 'v4';

insert into regras_estilo (guia_estilo_id, categoria, nome, padrao_deteccao, texto_orientacao, exemplo_antes, exemplo_depois, severidade_default)
select id, 'formalismo_fora_padrao', 'Conectivos cartoriais',
  '{"tipo": "regex_lista", "flags": "giu", "padroes": [
    {"regex": "\\bo\\s+que\\s+se\\s+faz\\s+para\\s+que\\s+produza\\s+seus\\s+jur[íi]dicos\\s+e\\s+legais\\s+efeitos\\b", "substituto": ""},
    {"regex": "\\bpor\\s+ser\\s+verdade,?\\s+firmam?\\s+o\\s+presente\\b", "substituto": "as partes firmam o presente"},
    {"regex": "\\be,?\\s+por\\s+estarem\\s+assim\\s+justos\\s+e\\s+contratados\\b", "substituto": "as partes"}
  ]}'::jsonb,
  'Conectivos de cartório engessam o texto sem acrescentar efeito jurídico; substitua por um fechamento direto ou remova.',
  'E, por estarem assim justos e contratados, firmam o presente instrumento.',
  'As partes firmam o presente instrumento.',
  'media'
from guias_estilo where versao = 'v4';

-- Categoria 4: ruído e informação desnecessária.
insert into regras_estilo (guia_estilo_id, categoria, nome, padrao_deteccao, texto_orientacao, exemplo_antes, exemplo_depois, severidade_default)
select id, 'ruido_informacao_desnecessaria', 'Cláusula que só enuncia que a lei se aplica',
  '{"tipo": "regex_lista", "flags": "giu", "padroes": [
    {"regex": "\\baplicam-se\\s+ao\\s+presente\\s+(?:contrato|instrumento)\\s+as\\s+disposi[çc][õo]es\\s+d[oa]\\s+c[óo]digo\\s+civil\\b", "substituto": ""}
  ]}'::jsonb,
  'Cláusulas que só dizem "a lei se aplica", sem detalhar qual artigo ou efeito específico, não acrescentam nada; remova ou substitua por uma remissão específica se houver um efeito real a destacar.',
  'Aplicam-se ao presente contrato as disposições do Código Civil.',
  '(remover, salvo remissão a artigo específico com efeito relevante para o caso)',
  'baixa'
from guias_estilo where versao = 'v4';

insert into regras_estilo (guia_estilo_id, categoria, nome, padrao_deteccao, texto_orientacao, exemplo_antes, exemplo_depois, severidade_default)
select id, 'ruido_informacao_desnecessaria', 'Considerando sem efeito jurídico',
  '{"tipo": "regex_lista", "flags": "giu", "padroes": [
    {"regex": "\\bconsiderando\\s+que\\s+as\\s+partes\\s+(?:desejam|pretendem|t[êe]m\\s+interesse)\\b", "substituto": ""}
  ]}'::jsonb,
  'Um "considerando" que não desdobra em nenhuma obrigação ou efeito é só ruído: remova, ou conecte-o explicitamente à cláusula que ele fundamenta.',
  'Considerando que as partes desejam formalizar a parceria; resolvem celebrar o presente contrato.',
  'As partes resolvem celebrar o presente contrato.',
  'baixa'
from guias_estilo where versao = 'v4';

insert into regras_estilo (guia_estilo_id, categoria, nome, padrao_deteccao, texto_orientacao, exemplo_antes, exemplo_depois, severidade_default)
select id, 'ruido_informacao_desnecessaria', 'Qualificação do preâmbulo repetida no corpo',
  '{"tipo": "similaridade_preambulo", "limiar": 0.6}'::jsonb,
  'A qualificação completa das partes (nome, documento, endereço, estado civil) já está no preâmbulo; repeti-la em uma cláusula do corpo é ruído. Referencie a parte pelo nome ou pela definição já estabelecida (ex.: "a CONTRATANTE").',
  'A CONTRATANTE, [nome completo, CNPJ, endereço já citados no preâmbulo], se compromete a...',
  'A CONTRATANTE se compromete a...',
  'baixa'
from guias_estilo where versao = 'v4';

-- Categoria 6: cláusulas ausentes (comparação estrutural com o modelo aprovado,
-- não um padrão de texto — ver detectarClausulasAusentes em src/lib/rules/estilo/motor.ts).
insert into regras_estilo (guia_estilo_id, categoria, nome, padrao_deteccao, texto_orientacao, exemplo_antes, exemplo_depois, severidade_default)
select id, 'clausulas_ausentes', 'Cláusula do modelo ausente na minuta',
  '{"tipo": "comparacao_com_modelo"}'::jsonb,
  'O modelo aprovado tem uma cláusula que não aparece na minuta enviada. Confirme se a omissão foi deliberada (o caso não pede aquela cláusula) ou se é um esquecimento antes de inserir de volta.',
  null,
  null,
  'media'
from guias_estilo where versao = 'v4';
