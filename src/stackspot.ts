/**
 * Cliente principal do StackSpot SDK
 * 
 * Interface similar ao OpenAI SDK
 */

import { StackSpotClient } from './client';
import { StackSpotConfig } from './types';
import { Assistants } from './resources/assistants';
import { Threads } from './resources/threads';

export class StackSpot {
  private client: StackSpotClient;
  private config: StackSpotConfig;
  public beta: {
    assistants: Assistants;
    threads: Threads;
  };

  constructor(config: StackSpotConfig) {
    this.config = config;
    this.client = new StackSpotClient(config);
    
    // Inicializa namespaces com tool executor se fornecido
    this.beta = {
      assistants: new Assistants(this.client),
      threads: new Threads(this.client, undefined, config.toolExecutor, config.enableFunctionCalling),
    };
  }

  /**
   * Obtém o cliente HTTP interno (para uso avançado)
   */
  getClient(): StackSpotClient {
    return this.client;
  }
}
