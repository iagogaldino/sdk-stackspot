/**
 * StackSpot SDK
 * 
 * SDK similar ao OpenAI SDK para integração com StackSpot GenAI API
 * Suporta criação de agentes, threads, mensagens e execução de runs
 */

import { StackSpotClient } from './client';
import { StackSpot } from './stackspot';

// Exporta o cliente principal
export { StackSpot, StackSpotClient };

// Exporta tipos
export * from './types';

// Exporta namespaces
export * from './resources/assistants';
export * from './resources/threads';
export * from './resources/messages';
export * from './resources/runs';

// Exporta utilitários
export * from './utils/functionCallParser';
export * from './utils/tokenNormalizer';
export * from './storage/FileStorage';

// Exporta por padrão
export default StackSpot;
