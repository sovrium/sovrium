/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The operator-tunable windows of a chat turn, all optional:
 *
 *  - `AI_MEMORY_MAX_AGE_DAYS`: conversations older than this many days are
 *    deleted at the start of the caller's next turn. Unset: kept forever.
 *  - `AI_MEMORY_CONTEXT_MESSAGES`: a turn replays only this many of its
 *    conversation's most recent messages. Unset: all of them.
 *  - `AI_CHAT_STREAM_TIMEOUT`: the milliseconds a streamed turn waits for the
 *    provider's FIRST chunk. Unset: no deadline.
 *
 * Each reads a leading whole number (`parseInt`), so `"30d"` is 30; zero, a
 * negative or an unreadable value means unset.
 */

type EnvSnapshot = Readonly<Record<string, string | undefined>>

/** A leading positive whole number, or `undefined`. */
const leadingPositiveInt = (raw: string | undefined): number | undefined => {
  if (raw === undefined || raw.trim() === '') return undefined
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

/** The retention window in days (`AI_MEMORY_MAX_AGE_DAYS`); `undefined` keeps every conversation. */
export const resolveChatMemoryMaxAgeDays = (env: EnvSnapshot): number | undefined =>
  leadingPositiveInt(env['AI_MEMORY_MAX_AGE_DAYS'])

/** The messages a turn replays (`AI_MEMORY_CONTEXT_MESSAGES`); `undefined` replays them all. */
export const resolveChatMemoryContextMessages = (env: EnvSnapshot): number | undefined =>
  leadingPositiveInt(env['AI_MEMORY_CONTEXT_MESSAGES'])

/** The first-chunk deadline of a streamed turn (`AI_CHAT_STREAM_TIMEOUT`); `undefined` waits. */
export const resolveChatStreamTimeoutMs = (env: EnvSnapshot): number | undefined =>
  leadingPositiveInt(env['AI_CHAT_STREAM_TIMEOUT'])
