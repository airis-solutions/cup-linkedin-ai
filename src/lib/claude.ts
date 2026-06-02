import Anthropic from '@anthropic-ai/sdk';
import { loadEnv } from '../config/env.js';
import { logger } from './logger.js';

const env = loadEnv();

export const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

export const ClaudeModels = {
  brain: env.CLAUDE_BRAIN_MODEL,
  router: env.CLAUDE_ROUTER_MODEL,
} as const;

export type ClaudeRole = keyof typeof ClaudeModels;

type CacheableSystemBlock = {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
};

export interface ClaudeCallParams {
  role: ClaudeRole;
  system: string | CacheableSystemBlock[];
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
  temperature?: number;
  metadata?: Record<string, string>;
}

export async function callClaude(params: ClaudeCallParams): Promise<Anthropic.Message> {
  const { role, system, messages, maxTokens = 1024, temperature = 0.7, metadata } = params;

  const model = ClaudeModels[role];

  logger.debug({ role, model, msg_count: messages.length, metadata }, 'claude.call');

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system: system as Anthropic.MessageCreateParams['system'],
    messages,
  });

  logger.info(
    {
      role,
      model,
      stop_reason: response.stop_reason,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_creation: response.usage.cache_creation_input_tokens ?? 0,
      cache_read: response.usage.cache_read_input_tokens ?? 0,
    },
    'claude.response',
  );

  return response;
}

export function asCacheableSystem(text: string): CacheableSystemBlock[] {
  return [{ type: 'text', text, cache_control: { type: 'ephemeral' } }];
}
