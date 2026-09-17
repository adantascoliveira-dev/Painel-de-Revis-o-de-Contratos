// Tipos do schema Supabase. Escritos à mão para refletir supabase/migrations/*.sql.
// Assim que o projeto Supabase existir de verdade, regenerar com:
//   npx supabase gen types typescript --linked > src/types/database.types.ts
// e reconferir contra este arquivo (a intenção de negócio documentada aqui —
// comentários, nomes — deve sobreviver à regeneração).

export type PerfilUsuario = 'socio' | 'advogado' | 'estagiario';
export type TipoCliente = 'holding' | 'empresa' | 'pessoa_fisica';
export type StatusDocumento =
  | 'rascunho'
  | 'em_checagem'
  | 'aguardando_socio'
  | 'em_ajuste_pela_equipe'
  | 'aprovado';
export type CategoriaSinalizacao =
  | 'juridiques_excesso'
  | 'tom_culpa'
  | 'formalismo_fora_padrao'
  | 'ruido_informacao_desnecessaria'
  | 'caso_cliente_generico'
  | 'clausulas_ausentes';
export type NaturezaSinalizacao = 'estilo' | 'contexto_negocio';
export type SeveridadeSinalizacao = 'baixa' | 'media' | 'alta';
export type ResolucaoSinalizacao = 'pendente' | 'aplicada' | 'mantida';
export type StatusJob = 'pendente' | 'processando' | 'concluido' | 'erro';
export type FonteReconciliacao = 'google_drive' | 'clickup' | 'manual';
export type StatusReconciliacao = 'pendente' | 'confirmado' | 'descartado' | 'mesclado';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface TipoPeca {
  id: string;
  slug: string;
  nome: string;
  grupo: string | null;
  ativo: boolean;
  criado_em: string;
}

export interface PreferenciasNegociadas {
  teto_responsabilidade?: string;
  foro?: string;
  prazo_sigilo_minimo_meses?: number;
  trava_incessibilidade?: boolean;
  dados_comerciais_sensiveis?: boolean;
  remuneracao_por_volume?: boolean;
  percentual_socios_pj?: number;
  [chave: string]: unknown;
}

export interface Cliente {
  id: string;
  nome: string;
  tipo: TipoCliente;
  documento_identificacao: string | null;
  estrutura_societaria: Record<string, unknown>;
  notas_operacao: string | null;
  preferencias_negociadas: PreferenciasNegociadas;
  google_drive_folder_id: string | null;
  clickup_client_id: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface ClienteContratoAnterior {
  id: string;
  cliente_id: string;
  tipo_peca_id: string;
  documento_id: string | null;
  fonte: 'google_drive' | 'sistema' | 'manual';
  referencia_externa: string | null;
  resumo_clausulas: Record<string, unknown>;
  data_documento: string | null;
  criado_em: string;
}

export interface GuiaEstilo {
  id: string;
  versao: string;
  vigente_desde: string;
  ativo: boolean;
  criado_em: string;
}

export interface PadraoRegexComSubstituto {
  regex: string;
  /** Aceita $1, $2... de grupos capturados e $& para o match inteiro. */
  substituto: string;
}

export type PadraoDeteccao =
  | { tipo: 'regex_lista'; padroes: PadraoRegexComSubstituto[]; flags?: string }
  | { tipo: 'similaridade_preambulo'; limiar: number }
  | { tipo: 'comparacao_com_modelo' };

export interface RegraEstilo {
  id: string;
  guia_estilo_id: string;
  categoria: Exclude<CategoriaSinalizacao, 'caso_cliente_generico'>;
  nome: string;
  padrao_deteccao: PadraoDeteccao;
  texto_orientacao: string;
  exemplo_antes: string | null;
  exemplo_depois: string | null;
  severidade_default: SeveridadeSinalizacao;
  ativo: boolean;
  criado_em: string;
}

export interface Clausula {
  numero: string | null;
  titulo: string | null;
  texto: string;
  offset_inicio: number;
  offset_fim: number;
}

export interface ModeloAprovado {
  id: string;
  codigo: string;
  tipo_peca_id: string;
  cliente_id: string | null;
  texto: string;
  clausulas: Clausula[];
  documento_origem_id: string | null;
  guia_estilo_id: string;
  aprovado_por: string;
  aprovado_em: string;
  versao: number;
  ativo: boolean;
  criado_em: string;
}

export interface Documento {
  id: string;
  titulo: string;
  arquivo_original_path: string | null;
  arquivo_original_nome: string | null;
  arquivo_original_mime: string | null;
  arquivo_original_tamanho_bytes: number | null;
  texto_extraido: string;
  texto_trabalho: string;
  clausulas: Clausula[];
  tipo_peca_id: string;
  cliente_id: string;
  autor_id: string;
  socio_revisor_id: string;
  modelo_aprovado_id: string | null;
  status: StatusDocumento;
  versao: number;
  documento_pai_id: string | null;
  categorias_checagem_habilitadas: CategoriaSinalizacao[];
  clickup_task_id: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface DocumentoTransicao {
  id: string;
  documento_id: string;
  status_anterior: StatusDocumento | null;
  status_novo: StatusDocumento;
  autor_id: string;
  observacao: string | null;
  prazo: string | null;
  criado_em: string;
}

export interface DocumentoSnapshot {
  id: string;
  documento_id: string;
  texto_trabalho: string;
  motivo: 'criacao' | 'transicao_status' | 'aplicacao_sinalizacao' | 'edicao_sinalizacao' | 'correcao_direta';
  transicao_id: string | null;
  criado_por: string;
  criado_em: string;
}

export type FonteInferenciaContexto = {
  tipo: 'contrato_anterior' | 'cadastro_cliente' | 'clausula_contrato_social';
  referencia_id?: string;
  detalhe: string;
};

export interface Sinalizacao {
  id: string;
  documento_id: string;
  clausula_numero: string | null;
  trecho_original: string;
  offset_inicio: number;
  offset_fim: number;
  categoria: CategoriaSinalizacao;
  natureza: NaturezaSinalizacao;
  sugestao_ajuste: string;
  justificativa: string;
  severidade: SeveridadeSinalizacao;
  fonte_inferencia: FonteInferenciaContexto | null;
  regra_estilo_id: string | null;
  resolucao: ResolucaoSinalizacao;
  resolvido_por: string | null;
  resolvido_em: string | null;
  texto_sugestao_editado: string | null;
  criado_em: string;
}

export interface Correcao {
  id: string;
  documento_id: string;
  autor_minuta_id: string;
  corrigido_por: string;
  categoria: CategoriaSinalizacao | null;
  clausula_numero: string | null;
  texto_antes: string;
  texto_depois: string;
  sinalizacao_origem_id: string | null;
  criado_em: string;
}

export interface PerfilObservacao {
  id: string;
  usuario_id: string;
  autor_id: string;
  texto: string;
  atualizado_em: string;
}

export interface AnaliseContextoClienteJob {
  id: string;
  documento_id: string;
  status: StatusJob;
  tentativas: number;
  erro: string | null;
  resultado_resumo: Record<string, unknown> | null;
  criado_em: string;
  iniciado_em: string | null;
  concluido_em: string | null;
}

export interface Notificacao {
  id: string;
  usuario_id: string;
  documento_id: string | null;
  tipo:
    | 'analise_contexto_concluida'
    | 'documento_aguardando_socio'
    | 'pedido_ajuste_equipe'
    | 'documento_aprovado'
    | 'reconciliacao_pendente';
  titulo: string;
  corpo: string;
  lida: boolean;
  criado_em: string;
}

export interface FonteReconciliacaoRow {
  id: string;
  cliente_candidato_nome: string;
  fonte: FonteReconciliacao;
  referencia_externa_id: string;
  dados_brutos: Record<string, unknown>;
  cliente_id_sugerido: string | null;
  similaridade: number | null;
  status: StatusReconciliacao;
  cliente_id_confirmado: string | null;
  confirmado_por: string | null;
  confirmado_em: string | null;
  criado_em: string;
}

export interface VwIndicadoresGerais {
  minutas_aprovadas: number;
  minutas_revisadas_pelo_socio: number;
  total_correcoes_socio: number;
  desvio_mais_comum: CategoriaSinalizacao | null;
  tempo_medio_revisao: string | null; // intervalo Postgres, ex.: "2 days 03:15:00"
}

export interface VwPerfilUsuario {
  usuario_id: string;
  nome: string;
  perfil: PerfilUsuario;
  volume_minutas: number;
  total_correcoes: number;
  media_correcoes_por_minuta: number;
}

export interface VwPerfilUsuarioCategoria {
  usuario_id: string;
  categoria: CategoriaSinalizacao;
  total: number;
  posicao: number;
}

export interface VwPerfilUsuarioEvolucaoMensal {
  usuario_id: string;
  mes: string;
  categoria: CategoriaSinalizacao | null;
  total: number;
}

