/**
 * Cliente HTTP para StackSpot API
 * 
 * Gerencia autenticação e requisições HTTP
 */

import fetch, { RequestInit as FetchRequestInit } from 'node-fetch';
import { StackSpotConfig, TokenResponse } from './types';
import { sdkLogger } from './utils/sdkLogger';

interface InternalConfig {
  clientId: string;
  clientSecret: string;
  realm: string;
  baseURL: string;
  inferenceBaseURL: string;
  timeout: number;
  toolExecutor?: StackSpotConfig['toolExecutor'];
  enableFunctionCalling?: boolean;
}

export class StackSpotClient {
  private config: InternalConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: StackSpotConfig) {
    this.config = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      realm: config.realm || 'stackspot-freemium',
      baseURL: config.baseURL || 'https://idm.stackspot.com',
      inferenceBaseURL: config.inferenceBaseURL || 'https://genai-inference-app.stackspot.com',
      timeout: config.timeout || 30000,
      toolExecutor: config.toolExecutor,
      enableFunctionCalling: config.enableFunctionCalling,
    };

    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error('clientId e clientSecret são obrigatórios');
    }
  }

  /**
   * Obtém ou renova o token de acesso
   */
  async getAccessToken(): Promise<string> {
    // Verifica se o token ainda é válido (com margem de 5 minutos)
    const now = Date.now();
    if (this.accessToken && this.tokenExpiresAt > now + 5 * 60 * 1000) {
      return this.accessToken;
    }

    // Renova o token
    await this.refreshToken();
    return this.accessToken!;
  }

  /**
   * Renova o token de acesso
   */
  private async refreshToken(): Promise<void> {
    const tokenURL = `${this.config.baseURL}/${this.config.realm}/oidc/oauth/token`;

    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    formData.append('client_id', this.config.clientId);
    formData.append('client_secret', this.config.clientSecret);

    try {
      sdkLogger.info('Tentando obter token de acesso', {
        url: tokenURL,
        clientId: this.config.clientId.substring(0, 8) + '...',
      });

      const response = await fetch(tokenURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'StackSpot-SDK/1.0.0',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        sdkLogger.error('Falha ao obter token de acesso', {
          status: response.status,
          response: errorText,
        });
        throw new Error(`Erro ao obter token: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as TokenResponse;
      this.accessToken = data.access_token;
      // Assume expiração em 1 hora se não for especificado
      this.tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
      sdkLogger.info('Token obtido com sucesso', {
        expiresIn: data.expires_in || 3600,
      });
    } catch (error: any) {
      sdkLogger.error('Falha ao autenticar', { error: error.message });
      throw new Error(`Falha ao autenticar: ${error.message}`);
    }
  }

  /**
   * Faz uma requisição HTTP autenticada
   */
  async request<T>(
    method: string,
    path: string,
    options: {
      body?: any;
      headers?: Record<string, string>;
      baseURL?: string;
      stream?: boolean;
    } = {}
  ): Promise<T> {
    const token = await this.getAccessToken();
    const baseURL = options.baseURL || this.config.inferenceBaseURL;
    const url = `${baseURL}${path}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'StackSpot-SDK/1.0.0',
      ...options.headers,
    };

    // Log de debug (pode ser removido em produção)
    sdkLogger.info('Realizando requisição para API StackSpot', {
      method,
      url,
    });

    const fetchOptions: FetchRequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.config.timeout),
    };

    if (options.body) {
      if (options.stream) {
        // Para streaming, não stringify o body
        fetchOptions.body = options.body;
      } else {
        fetchOptions.body = JSON.stringify(options.body);
      }
    }

    try {
      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        sdkLogger.error('Requisição para API StackSpot falhou', {
          status: response.status,
          url,
          response: errorText,
        });
        throw new Error(errorMessage);
      }

      // Para streaming, retorna o response diretamente
      if (options.stream) {
        return response as any;
      }

      // Lê a resposta e faz parse do JSON
      const responseText = await response.text();
      
      let parsedResponse: T;
      try {
        parsedResponse = JSON.parse(responseText) as T;
      } catch (parseError) {
        // Se não for JSON, retorna como string
        return responseText as T;
      }

      return parsedResponse;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  /**
   * GET request
   */
  async get<T>(path: string, options?: { headers?: Record<string, string>; baseURL?: string }): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  /**
   * POST request
   */
  async post<T>(
    path: string,
    body?: any,
    options?: { headers?: Record<string, string>; baseURL?: string; stream?: boolean }
  ): Promise<T> {
    return this.request<T>('POST', path, { ...options, body });
  }

  /**
   * PUT request
   */
  async put<T>(
    path: string,
    body?: any,
    options?: { headers?: Record<string, string>; baseURL?: string }
  ): Promise<T> {
    return this.request<T>('PUT', path, { ...options, body });
  }

  /**
   * DELETE request
   */
  async delete<T>(path: string, options?: { headers?: Record<string, string>; baseURL?: string }): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }
}
