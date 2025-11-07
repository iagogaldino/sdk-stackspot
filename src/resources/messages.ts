/**
 * Recurso de Messages (Mensagens)
 * 
 * Gerencia mensagens dentro de threads
 */

import { StackSpotClient } from '../client';
import { Threads } from './threads';
import {
  Message,
  CreateMessageParams,
  PaginatedList,
} from '../types';
import { StorageAdapter } from '../storage/FileStorage';

export class Messages {
  private storage?: StorageAdapter;

  constructor(
    private client: StackSpotClient,
    private threads: Threads,
    storage?: StorageAdapter
  ) {
    this.storage = storage;
  }

  /**
   * Cria uma nova mensagem em uma thread
   */
  async create(threadId: string, params: CreateMessageParams): Promise<Message> {
    // Verifica se a thread existe
    await this.threads.retrieve(threadId);

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const message: Message = {
      id: messageId,
      object: 'thread.message',
      created_at: Math.floor(Date.now() / 1000),
      thread_id: threadId,
      role: params.role,
      content: [
        {
          type: 'text',
          text: {
            value: params.content,
          },
        },
      ],
      metadata: params.metadata,
    };

    // Adiciona a mensagem à thread (agora é async)
    await this.threads.addThreadMessage(threadId, message);

    return message;
  }

  /**
   * Lista mensagens de uma thread
   */
  async list(
    threadId: string,
    params?: { limit?: number; order?: 'asc' | 'desc'; after?: string; before?: string }
  ): Promise<PaginatedList<Message>> {
    // Verifica se a thread existe
    await this.threads.retrieve(threadId);

    let messages = this.threads.getThreadMessages(threadId);

    // Aplica ordenação
    const order = params?.order || 'desc';
    if (order === 'asc') {
      messages = [...messages].sort((a, b) => a.created_at - b.created_at);
    } else {
      messages = [...messages].sort((a, b) => b.created_at - a.created_at);
    }

    // Aplica limite
    const limit = params?.limit || 20;
    const limitedMessages = messages.slice(0, limit);

    return {
      object: 'list',
      data: limitedMessages,
      has_more: messages.length > limit,
    };
  }

  /**
   * Obtém uma mensagem específica
   */
  async retrieve(threadId: string, messageId: string): Promise<Message> {
    // Verifica se a thread existe
    await this.threads.retrieve(threadId);

    const messages = this.threads.getThreadMessages(threadId);
    const message = messages.find((m) => m.id === messageId);

    if (!message) {
      throw new Error(`Mensagem ${messageId} não encontrada na thread ${threadId}`);
    }

    return message;
  }

  /**
   * Atualiza uma mensagem
   */
  async update(
    threadId: string,
    messageId: string,
    metadata?: Record<string, any>
  ): Promise<Message> {
    const message = await this.retrieve(threadId, messageId);
    message.metadata = { ...message.metadata, ...metadata };
    return message;
  }
}
