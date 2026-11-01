/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The chat reply of a turn: the `{ reply, actions, sessionId }` envelope, and
 * for a turn that called tools, one `type: 'query'` entry per call that ran
 * (its reply text is `toolTurnReply`, in the domain).
 */

import { chatResponseSchema } from '@/domain/models/api/ai/chat'
import { shapedJson } from '@/presentation/api/runtime/run-effect'
import type { ChatAction, ChatResponse } from '@/domain/models/api/ai/chat'
import type { Context } from 'hono'

/**
 * Build the `{ reply, actions, sessionId }` 200 chat envelope, attaching the
 * `X-RateLimit-Remaining` header when rate limiting is configured. Shared by
 * the tool-calling and read-query completion paths.
 */
export const respondWithActions = (
  c: Context,
  parts: {
    readonly reply: string
    readonly actions: ReadonlyArray<ChatAction>
    readonly sessionId: string
    readonly rateLimitRemaining: number | undefined
    /** The knowledge passages the reply marks, when it marks any. */
    readonly citations?: ChatResponse['citations']
  }
): Response => {
  const body: ChatResponse = {
    reply: parts.reply,
    actions: [...parts.actions],
    sessionId: parts.sessionId,
    ...(parts.citations !== undefined && { citations: parts.citations }),
  }
  if (parts.rateLimitRemaining !== undefined) {
    c.header('X-RateLimit-Remaining', parts.rateLimitRemaining.toString())
  }
  return shapedJson(c, body, chatResponseSchema)
}

/**
 * One `type: 'query'` action per tool call the turn RAN. `actions` reports what
 * the AI did, so a call the gates refused, one held for approval, or an action
 * that failed is left out: none of them changed or read anything, and listing
 * it would tell the client a write ran when nothing ran. The model's reply says
 * what happened to them.
 */
export const toolTurnActions = (
  results: ReadonlyArray<{
    readonly name: string
    readonly table?: string | undefined
    readonly outcome: string
  }>
): ReadonlyArray<ChatAction> =>
  results
    .filter((result) => result.outcome === 'ok')
    .map((result) => ({
      type: 'query',
      ...(result.table !== undefined && { table: result.table }),
      description: `Tool ${result.name} executed.`,
    }))
