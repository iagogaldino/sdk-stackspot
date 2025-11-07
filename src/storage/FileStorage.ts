/**
 * FileStorage - Persistência de dados em arquivos JSON
 * 
 * Armazena threads, messages e runs em arquivos JSON dentro do SDK
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { Thread, Message, Run } from '../types';
import { sdkLogger } from '../utils/sdkLogger';

export interface StorageAdapter {
  saveThread(thread: Thread): Promise<void>;
  loadThread(threadId: string): Promise<Thread | null>;
  listThreads(): Promise<Thread[]>;
  deleteThread(threadId: string): Promise<void>;
  
  saveMessage(threadId: string, message: Message): Promise<void>;
  loadMessages(threadId: string): Promise<Message[]>;
  
  saveRun(threadId: string, run: Run): Promise<void>;
  loadRun(threadId: string, runId: string): Promise<Run | null>;
  listRuns(threadId: string): Promise<Run[]>;
}

export class FileStorage implements StorageAdapter {
  private storagePath: string;
  private data: {
    threads: Record<string, Thread>;
    messages: Record<string, Message[]>;
    runs: Record<string, Record<string, Run>>;
  } = {
    threads: {},
    messages: {},
    runs: {},
  };

  constructor(storagePath?: string) {
    // Se não especificado, usa diretório do SDK
    if (storagePath) {
      this.storagePath = path.resolve(storagePath);
    } else {
      // Usa diretório do SDK para armazenar dados
      this.storagePath = path.join(__dirname, '../../data/stackspot-storage.json');
    }
    
    // Garante que o diretório existe
    this.ensureDirectoryExists();
    
    // Carrega dados existentes
    this.loadData().catch(err => {
      sdkLogger.warn('Erro ao carregar dados do storage, usando estrutura vazia', {
        error: err.message,
      });
    });
  }

  private async ensureDirectoryExists(): Promise<void> {
    const dir = path.dirname(this.storagePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error: any) {
      // Ignora erro se diretório já existe
      if (error.code !== 'EEXIST') {
        sdkLogger.warn('Erro ao criar diretório de storage', {
          error: error.message,
        });
      }
    }
  }

  private async loadData(): Promise<void> {
    try {
      if (existsSync(this.storagePath)) {
        const content = await fs.readFile(this.storagePath, 'utf-8');
        this.data = JSON.parse(content);
        sdkLogger.info('Storage carregado do disco', {
          file: this.storagePath,
          threads: Object.keys(this.data.threads).length,
        });
      }
    } catch (error: any) {
      sdkLogger.warn('Falha ao carregar storage, usando estrutura vazia', {
        error: error.message,
      });
      // Inicializa com estrutura vazia se houver erro
      this.data = {
        threads: {},
        messages: {},
        runs: {},
      };
    }
  }

  private async saveData(): Promise<void> {
    try {
      await this.ensureDirectoryExists();
      await fs.writeFile(this.storagePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error: any) {
      sdkLogger.error('Erro ao salvar storage', { error: error.message });
      throw error;
    }
  }

  async saveThread(thread: Thread): Promise<void> {
    this.data.threads[thread.id] = thread;
    await this.saveData();
  }

  async loadThread(threadId: string): Promise<Thread | null> {
    await this.loadData();
    return this.data.threads[threadId] || null;
  }

  async listThreads(): Promise<Thread[]> {
    await this.loadData();
    return Object.values(this.data.threads);
  }

  async deleteThread(threadId: string): Promise<void> {
    delete this.data.threads[threadId];
    delete this.data.messages[threadId];
    delete this.data.runs[threadId];
    await this.saveData();
  }

  async saveMessage(threadId: string, message: Message): Promise<void> {
    if (!this.data.messages[threadId]) {
      this.data.messages[threadId] = [];
    }
    // Verifica se a mensagem já existe (evita duplicatas)
    const existingIndex = this.data.messages[threadId].findIndex(m => m.id === message.id);
    if (existingIndex >= 0) {
      this.data.messages[threadId][existingIndex] = message;
    } else {
      this.data.messages[threadId].push(message);
    }
    await this.saveData();
  }

  async loadMessages(threadId: string): Promise<Message[]> {
    await this.loadData();
    return this.data.messages[threadId] || [];
  }

  async saveRun(threadId: string, run: Run): Promise<void> {
    if (!this.data.runs[threadId]) {
      this.data.runs[threadId] = {};
    }
    this.data.runs[threadId][run.id] = run;
    await this.saveData();
  }

  async loadRun(threadId: string, runId: string): Promise<Run | null> {
    await this.loadData();
    return this.data.runs[threadId]?.[runId] || null;
  }

  async listRuns(threadId: string): Promise<Run[]> {
    await this.loadData();
    return Object.values(this.data.runs[threadId] || {});
  }
}

