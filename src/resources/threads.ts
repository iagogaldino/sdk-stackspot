/**
 * Recurso de Threads (Conversas)
 * 
 * Gerencia criação e gerenciamento de threads/conversas
 * 
 * Nota: StackSpot não tem threads nativas, então simulamos isso
 * mantendo o histórico de mensagens no lado do cliente.
 */

import { StackSpotClient } from '../client';
import {
  Thread,
  CreateThreadParams,
  Message,
  CreateMessageParams,
  CreateRunParams,
  Run,
  ToolExecutor,
} from '../types';
import { Messages } from './messages';
import { Runs } from './runs';
import { StorageAdapter, FileStorage } from '../storage/FileStorage';
import { sdkLogger } from '../utils/sdkLogger';

export class Threads {
  public messages: Messages;
  public runs: Runs;

  // Armazena threads em memória (também persiste em arquivo)
  private threads: Map<string, Thread> = new Map();
  private threadMessages: Map<string, Message[]> = new Map();
  private storage?: StorageAdapter;

  constructor(
    private client: StackSpotClient, 
    storage?: StorageAdapter,
    toolExecutor?: ToolExecutor,
    enableFunctionCalling?: boolean
  ) {
    this.storage = storage || new FileStorage();
    this.messages = new Messages(client, this, this.storage);
    this.runs = new Runs(client, this, this.storage, toolExecutor, enableFunctionCalling);
    
    // Carrega threads do storage ao iniciar
    this.loadFromStorage().catch(err => {
      sdkLogger.warn('Erro ao carregar threads do storage no bootstrap', {
        error: err.message,
      });
    });
  }

  private async loadFromStorage(): Promise<void> {
    if (!this.storage) return;
    
    try {
      const threads = await this.storage.listThreads();
      for (const thread of threads) {
        this.threads.set(thread.id, thread);
        const messages = await this.storage.loadMessages(thread.id);
        this.threadMessages.set(thread.id, messages);
      }
      sdkLogger.info('Threads carregadas do storage', { count: threads.length });
    } catch (error: any) {
      sdkLogger.warn('Erro ao carregar threads do storage', { error: error.message });
    }
  }

  /**
   * Cria uma nova thread
   */
  async create(params?: CreateThreadParams): Promise<Thread> {
    const threadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const thread: Thread = {
      id: threadId,
      object: 'thread',
      created_at: Math.floor(Date.now() / 1000),
      metadata: params?.metadata,
    };

    this.threads.set(threadId, thread);
    this.threadMessages.set(threadId, []);
    
    // Salva no storage se disponível
    if (this.storage) {
      await this.storage.saveThread(thread);
    }

    // Se houver mensagens iniciais, adiciona elas
    if (params?.messages && params.messages.length > 0) {
      for (const msgParams of params.messages) {
        await this.messages.create(threadId, msgParams);
      }
    }

    return thread;
  }

  /**
   * Obtém uma thread específica
   */
  async retrieve(threadId: string): Promise<Thread> {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error(`Thread ${threadId} não encontrada`);
    }
    return thread;
  }

  /**
   * Atualiza uma thread
   */
  async update(threadId: string, metadata?: Record<string, any>): Promise<Thread> {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error(`Thread ${threadId} não encontrada`);
    }

    thread.metadata = { ...thread.metadata, ...metadata };
    this.threads.set(threadId, thread);
    
    // Salva no storage se disponível
    if (this.storage) {
      await this.storage.saveThread(thread);
    }

    return thread;
  }

  /**
   * Deleta uma thread
   */
  async del(threadId: string): Promise<{ id: string; object: string; deleted: boolean }> {
    this.threads.delete(threadId);
    this.threadMessages.delete(threadId);
    
    // Remove do storage se disponível
    if (this.storage) {
      await this.storage.deleteThread(threadId);
    }

    return {
      id: threadId,
      object: 'thread.deleted',
      deleted: true,
    };
  }

  /**
   * Obtém mensagens de uma thread (método interno)
   */
  getThreadMessages(threadId: string): Message[] {
    return this.threadMessages.get(threadId) || [];
  }

  /**
   * Adiciona mensagem a uma thread (método interno)
   */
  async addThreadMessage(threadId: string, message: Message): Promise<void> {
    const messages = this.threadMessages.get(threadId) || [];
    messages.push(message);
    this.threadMessages.set(threadId, messages);
    
    // Salva no storage se disponível
    if (this.storage) {
      await this.storage.saveMessage(threadId, message);
    }
  }
}
