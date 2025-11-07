/**
 * Recurso de Assistants (Agentes)
 * 
 * Gerencia criação, listagem e atualização de agentes
 */

import { StackSpotClient } from '../client';
import {
  AssistantConfig,
  CreateAssistantParams,
  UpdateAssistantParams,
  PaginatedList,
} from '../types';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { sdkLogger } from '../utils/sdkLogger';

export class Assistants {
  private agentCache: Map<string, AssistantConfig> = new Map();
  private cacheLoaded = false;

  constructor(private client: StackSpotClient) {
    // Carrega agentes do agents.json automaticamente
    this.loadAgentsFromConfig().catch(err => {
      sdkLogger.warn('Erro ao carregar agentes do config:', err.message);
    });
  }

  /**
   * Carrega agentes do agents.json
   */
  private async loadAgentsFromConfig(): Promise<void> {
    try {
      // Tenta encontrar agents.json no projeto
      const possiblePaths = [
        path.join(process.cwd(), 'src/agents/agents.json'),
        path.join(process.cwd(), 'agents.json'),
        path.join(__dirname, '../../../src/agents/agents.json'),
        path.join(__dirname, '../../../../src/agents/agents.json'),
      ];

      let agentsData: any = null;
      let configPath: string | null = null;
      
      for (const configPathCandidate of possiblePaths) {
        try {
          if (existsSync(configPathCandidate)) {
            const content = await fs.readFile(configPathCandidate, 'utf-8');
            agentsData = JSON.parse(content);
            configPath = configPathCandidate;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!agentsData) {
        sdkLogger.warn('agents.json não encontrado, cache de agentes vazio');
        return;
      }

      sdkLogger.info('Carregando configuração de agentes', { file: configPath });

      // Processa agentes do JSON
      const agents: AssistantConfig[] = [];

      // Adiciona mainSelector se existir
      if (agentsData.mainSelector) {
        const mainSelector = agentsData.mainSelector;
        agents.push({
          id: mainSelector.stackspotAgentId || `asst_${mainSelector.name}`,
          name: mainSelector.name,
          instructions: mainSelector.instructions,
          model: mainSelector.model,
          tools: mainSelector.tools || [],
        });
      }

      // Adiciona grupos e seus agentes
      if (agentsData.groups) {
        for (const group of agentsData.groups) {
          // Orquestrador
          if (group.orchestrator) {
            agents.push({
              id: group.orchestrator.stackspotAgentId || `asst_${group.orchestrator.name}`,
              name: group.orchestrator.name,
              instructions: group.orchestrator.instructions,
              model: group.orchestrator.model,
              tools: group.orchestrator.tools || [],
            });
          }

          // Agentes do grupo
          if (group.agents) {
            for (const agent of group.agents) {
              agents.push({
                id: agent.stackspotAgentId || `asst_${agent.name}`,
                name: agent.name,
                instructions: agent.instructions,
                model: agent.model,
                tools: agent.tools || [],
              });
            }
          }
        }
      }

      // Adiciona fallback se existir
      if (agentsData.fallbackAgent) {
        agents.push({
          id: agentsData.fallbackAgent.stackspotAgentId || `asst_${agentsData.fallbackAgent.name}`,
          name: agentsData.fallbackAgent.name,
          instructions: agentsData.fallbackAgent.instructions,
          model: agentsData.fallbackAgent.model,
          tools: agentsData.fallbackAgent.tools || [],
        });
      }

      // Popula cache
      for (const agent of agents) {
        if (agent.id) {
          this.agentCache.set(agent.id, agent);
          // Também indexa por nome para busca
          if (agent.name) {
            this.agentCache.set(agent.name, agent);
          }
        }
      }

      this.cacheLoaded = true;
      sdkLogger.info('Agentes carregados do arquivo', { count: agents.length });
    } catch (error: any) {
      sdkLogger.error('Erro ao carregar agentes:', error.message);
    }
  }

  /**
   * Cria um novo agente
   * 
   * Nota: StackSpot não tem API para criar agentes dinamicamente.
   * Os agentes são criados no painel do StackSpot.
   * Este método apenas valida e retorna a configuração.
   */
  async create(params: CreateAssistantParams): Promise<AssistantConfig> {
    // Validação básica
    if (!params.name && !params.instructions) {
      throw new Error('name ou instructions são obrigatórios');
    }

    // Gera um ID simulado (na prática, você deve usar o ID do agente criado no StackSpot)
    const assistantId = `asst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      id: assistantId,
      name: params.name,
      instructions: params.instructions,
      model: params.model,
      tools: params.tools || [],
    };
  }

  /**
   * Lista agentes
   * 
   * Retorna agentes carregados do agents.json
   */
  async list(params?: { limit?: number; after?: string; before?: string }): Promise<PaginatedList<AssistantConfig>> {
    if (!this.cacheLoaded) {
      await this.loadAgentsFromConfig();
    }

    // Filtra apenas agentes com IDs válidos (remove duplicatas por nome)
    const uniqueAgents = new Map<string, AssistantConfig>();
    for (const [key, agent] of this.agentCache.entries()) {
      // Se a chave é um ID (não começa com "asst_" ou contém "01K"), adiciona
      if (agent.id && (agent.id.startsWith('01K') || !agent.id.startsWith('asst_'))) {
        uniqueAgents.set(agent.id, agent);
      } else if (agent.id && key === agent.id) {
        // Se a chave é o ID do agente, adiciona
        uniqueAgents.set(agent.id, agent);
      }
    }
    
    let agents = Array.from(uniqueAgents.values());

    // Aplica paginação (after/before)
    let startIndex = 0;
    if (params?.after) {
      const afterIndex = agents.findIndex(a => a.id === params.after);
      if (afterIndex >= 0) startIndex = afterIndex + 1;
    }
    if (params?.before) {
      const beforeIndex = agents.findIndex(a => a.id === params.before);
      if (beforeIndex >= 0) agents = agents.slice(0, beforeIndex);
    }

    // Aplica limite
    const limit = params?.limit || 20;
    const limitedAgents = agents.slice(startIndex, startIndex + limit);

    return {
      object: 'list',
      data: limitedAgents,
      has_more: startIndex + limit < agents.length,
      first_id: limitedAgents[0]?.id,
      last_id: limitedAgents[limitedAgents.length - 1]?.id,
    };
  }

  /**
   * Obtém um agente específico
   * 
   * Busca no cache carregado do agents.json
   */
  async retrieve(assistantId: string): Promise<AssistantConfig> {
    if (!this.cacheLoaded) {
      await this.loadAgentsFromConfig();
    }

    const agent = this.agentCache.get(assistantId);
    if (agent) {
      return agent;
    }

    // Se não encontrou, retorna básico (compatibilidade)
    return {
      id: assistantId,
    };
  }

  /**
   * Atualiza um agente
   * 
   * Nota: StackSpot não tem API para atualizar agentes dinamicamente.
   * As atualizações devem ser feitas no painel do StackSpot.
   */
  async update(assistantId: string, params: UpdateAssistantParams): Promise<AssistantConfig> {
    return {
      id: assistantId,
      name: params.name,
      instructions: params.instructions,
      model: params.model,
      tools: params.tools,
    };
  }

  /**
   * Deleta um agente
   * 
   * Nota: StackSpot não tem API para deletar agentes.
   * A deleção deve ser feita no painel do StackSpot.
   */
  async del(assistantId: string): Promise<{ id: string; object: string; deleted: boolean }> {
    return {
      id: assistantId,
      object: 'assistant.deleted',
      deleted: true,
    };
  }
}
