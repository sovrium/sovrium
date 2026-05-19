/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { AiError } from '@/application/ports/services/ai-service'

export type ChatTurnError = AiError

export const chatErrorStatus = (err: ChatTurnError): 502 | 503 | 504 => {
  if (err._tag === 'AiTimeoutError') return 504
  if (err._tag === 'AiConfigError') return 503
  return err.statusCode === 503 ? 503 : 502
}

export const chatErrorMessage = (status: 502 | 503 | 504): string => {
  switch (status) {
    case 504:
      return 'The AI service timed out. Please try again.'
    case 503:
      return 'The AI service is temporarily unavailable. Please try again later.'
    case 502:
      return 'The AI service encountered an error. Please try again.'
  }
}

const parsePositiveIntEnv = (raw: string | undefined): number | undefined => {
  if (raw === undefined || raw.trim() === '') return undefined
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

export interface ChatErrorConfig {
  readonly timeoutMs: number | undefined
  readonly maxMessageLength: number | undefined
  readonly maxRetries: number | undefined
}

export const resolveChatErrorConfig = (
  env: Readonly<Record<string, string | undefined>> = process.env
): ChatErrorConfig => ({
  timeoutMs: parsePositiveIntEnv(env.AI_CHAT_TIMEOUT),
  maxMessageLength: parsePositiveIntEnv(env.AI_CHAT_MAX_MESSAGE_LENGTH),
  maxRetries: parsePositiveIntEnv(env.AI_CHAT_MAX_RETRIES),
})

export const isTransientChatError = (err: ChatTurnError): boolean => {
  if (err._tag !== 'AiProviderError') return false
  return err.statusCode === 503 || err.statusCode === 429
}
