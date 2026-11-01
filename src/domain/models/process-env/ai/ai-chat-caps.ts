/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parsePositiveIntEnv } from '../positive-int-env'
import { resolveCloudProvider } from './ai-eco-routing'

/**
 * Chat caps that default ON when the chat answers through a metered provider.
 *
 * Every question sent to a hosted provider costs money, so a signed-in user's
 * chat is capped by default there: {@link METERED_CHAT_RATE_LIMIT} messages per
 * window and {@link METERED_CHAT_MAX_MESSAGE_LENGTH} characters per message. A
 * local Ollama model (or no provider at all) keeps no cap until the operator
 * sets one.
 *
 * For both variables:
 *  - a positive whole number always wins;
 *  - an explicit `0` means "no limit", whatever the provider;
 *  - unset, blank or unusable → the metered default, or no limit when local.
 */

/** Messages per window a signed-in user may send to a metered provider by default. */
export const METERED_CHAT_RATE_LIMIT = 60

/** Characters one chat message may hold on a metered provider by default. */
export const METERED_CHAT_MAX_MESSAGE_LENGTH = 10_000

type EnvSnapshot = Readonly<Record<string, string | undefined>>

/** Whether `AI_PROVIDER` names a provider other than a local Ollama model. */
export const isMeteredAiProvider = (env: EnvSnapshot): boolean =>
  resolveCloudProvider(env) !== undefined

const isExplicitZero = (raw: string | undefined): boolean =>
  raw !== undefined && /^\s*0+\s*$/.test(raw)

const resolveChatCap = (
  raw: string | undefined,
  env: EnvSnapshot,
  meteredDefault: number
): number | undefined => {
  const explicit = parsePositiveIntEnv(raw)
  if (explicit !== undefined) return explicit
  if (isExplicitZero(raw)) return undefined
  return isMeteredAiProvider(env) ? meteredDefault : undefined
}

/** The per-user chat rate limit (`AI_CHAT_RATE_LIMIT`); `undefined` → no limit. */
export const resolveUserChatRateLimit = (env: EnvSnapshot): number | undefined =>
  resolveChatCap(env['AI_CHAT_RATE_LIMIT'], env, METERED_CHAT_RATE_LIMIT)

/** The chat message length cap (`AI_CHAT_MAX_MESSAGE_LENGTH`); `undefined` → no limit. */
export const resolveChatMaxMessageLength = (env: EnvSnapshot): number | undefined =>
  resolveChatCap(env['AI_CHAT_MAX_MESSAGE_LENGTH'], env, METERED_CHAT_MAX_MESSAGE_LENGTH)
