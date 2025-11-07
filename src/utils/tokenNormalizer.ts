/**
 * Normalização de Tokens
 * 
 * Converte tokens do formato StackSpot para formato OpenAI
 */

import { TokenUsage } from '../types';
import { ChatResponse } from '../types';

/**
 * Normaliza tokens da resposta do StackSpot para formato OpenAI
 */
export function normalizeTokens(stackspotResponse: ChatResponse): TokenUsage {
  const tokens = stackspotResponse.tokens || {};
  
  return {
    prompt_tokens: tokens.input || tokens.user || 0,
    completion_tokens: tokens.output || 0,
    total_tokens: (tokens.input || tokens.user || 0) + (tokens.output || 0),
  };
}

