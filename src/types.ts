/**
 * Tipos e interfaces do StackSpot SDK
 */

/**
 * Callback para executar uma função/tool
 * Usado para function calling simulado (StackSpot não suporta nativo)
 */
export type ToolExecutor = (functionName: string, args: Record<string, any>) => Promise<string>;

/**
 * Configuração do cliente StackSpot
 */
export interface StackSpotConfig {
  clientId: string;
  clientSecret: string;
  realm?: string;
  baseURL?: string;
  inferenceBaseURL?: string;
  timeout?: number;
  /**
   * Callback opcional para executar tools/funções
   * Se fornecido, o SDK detectará e executará function calls automaticamente
   */
  toolExecutor?: ToolExecutor;
  /**
   * Habilita detecção automática de function calling (padrão: true se toolExecutor fornecido)
   */
  enableFunctionCalling?: boolean;
}

/**
 * Resposta de autenticação OAuth2
 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

/**
 * Configuração de um agente (assistant)
 */
export interface AssistantConfig {
  id?: string;
  name?: string;
  instructions?: string;
  model?: string;
  tools?: Tool[];
}

/**
 * Ferramenta disponível para o agente
 */
export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters?: Record<string, any>;
  };
}

/**
 * Thread (conversa)
 */
export interface Thread {
  id: string;
  object: 'thread';
  created_at: number;
  metadata?: Record<string, any>;
}

/**
 * Mensagem em uma thread
 */
export interface Message {
  id: string;
  object: 'thread.message';
  created_at: number;
  thread_id: string;
  role: 'user' | 'assistant' | 'system';
  content: MessageContent[];
  metadata?: Record<string, any>;
}

/**
 * Conteúdo de uma mensagem
 */
export interface MessageContent {
  type: 'text';
  text: {
    value: string;
    annotations?: any[];
  };
}

/**
 * Run (execução de um agente em uma thread)
 */
export interface Run {
  id: string;
  object: 'thread.run';
  created_at: number;
  thread_id: string;
  assistant_id: string;
  status: 'queued' | 'in_progress' | 'requires_action' | 'cancelling' | 'cancelled' | 'failed' | 'completed';
  required_action?: {
    type: 'submit_tool_outputs';
    submit_tool_outputs: {
      tool_calls: ToolCall[];
    };
  };
  last_error?: {
    code: string;
    message: string;
  };
  expires_at?: number;
  started_at?: number;
  cancelled_at?: number;
  failed_at?: number;
  completed_at?: number;
  model?: string;
  instructions?: string;
  tools?: Tool[];
  metadata?: Record<string, any>;
  usage?: TokenUsage;
}

/**
 * Chamada de ferramenta durante um run
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Parâmetros para criar um agente
 */
export interface CreateAssistantParams {
  name?: string;
  instructions?: string;
  model?: string;
  tools?: Tool[];
  metadata?: Record<string, any>;
}

/**
 * Parâmetros para atualizar um agente
 */
export interface UpdateAssistantParams {
  name?: string;
  instructions?: string;
  model?: string;
  tools?: Tool[];
  metadata?: Record<string, any>;
}

/**
 * Parâmetros para criar uma thread
 */
export interface CreateThreadParams {
  messages?: CreateMessageParams[];
  metadata?: Record<string, any>;
}

/**
 * Parâmetros para criar uma mensagem
 */
export interface CreateMessageParams {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
}

/**
 * Parâmetros para criar um run
 */
export interface CreateRunParams {
  assistant_id: string;
  model?: string;
  instructions?: string;
  tools?: Tool[];
  metadata?: Record<string, any>;
  stream?: boolean;
}

/**
 * Parâmetros para chat (StackSpot específico)
 */
export interface ChatParams {
  user_prompt: string;
  streaming?: boolean;
  stackspot_knowledge?: boolean;
  return_ks_in_response?: boolean;
}

/**
 * Resposta de chat
 */
export interface ChatResponse {
  message?: string;
  stop_reason?: string;
  tokens?: {
    user?: number | null;
    enrichment?: number | null;
    input?: number;
    output?: number;
  };
  upload_ids?: Record<string, any>;
  knowledge_source_id?: any[];
  source?: any[];
  cross_account_source?: any[];
  tools_id?: any[];
  // Campos legados para compatibilidade
  response?: string;
  knowledge_sources?: any[];
  metadata?: Record<string, any>;
}

/**
 * Evento de streaming
 */
export interface StreamEvent {
  type: 'message' | 'error' | 'done';
  data?: any;
  error?: string;
}

/**
 * Uso de tokens (simulado para compatibilidade)
 */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Lista paginada
 */
export interface PaginatedList<T> {
  object: 'list';
  data: T[];
  first_id?: string;
  last_id?: string;
  has_more: boolean;
}
