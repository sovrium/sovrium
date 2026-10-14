/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The chat reply of a turn: the `{ reply, actions, sessionId }` envelope, and
 * for a turn that called tools, its reply text and one `type: 'query'` entry
 * per call that ran.
 */

import type { ChatAction, ChatResponse } from '@/domain/models/api/ai/chat'
import type { Context } from 'hono'

/**
 * User-facing reply text when every tool the model requested in a turn was
 * blocked by RBAC. Surfaced verbatim so the caller learns the request was
 * denied rather than receiving an empty reply.
 */
const RBAC_DENIED_REPLY =
  'I cannot complete that request — you do not have permission to access the requested data.'

/**
 * Reply text for a turn that EXECUTED tools but settled without any assistant
 * prose — the model kept requesting tools until the iteration budget ran out
 * or the follow-up provider call failed.
 *
 * Deliberately not a fabricated answer: it reports what is actually known —
 * that the lookups ran and no summary came back — and points at the `actions[]`
 * that accompany it, which carry the real record of what happened. The
 * alternative shipped today is an EMPTY assistant bubble, which a chat surface
 * renders as a turn that silently did nothing, hiding work that in fact
 * executed against the operator's data.
 */
const NO_SUMMARY_REPLY =
  'I completed the requested lookups, but the assistant did not return a final summary. The actions taken are listed alongside this reply.'

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
    return c.json(body, 200, { 'X-RateLimit-Remaining': parts.rateLimitRemaining.toString() })
  }
  return c.json(body, 200)
}

/**
 * The reply of a turn that called tools: the model's final answer, else the
 * denial when the turn ended on refused calls, else a note that the lookups
 * ran without a summary — never an empty bubble for work that did run.
 */
export const toolTurnReply = (
  reply: string,
  results: ReadonlyArray<{ readonly outcome: string }>
): string => {
  if (reply.length > 0) return reply
  return results.at(-1)?.outcome === 'denied' ? RBAC_DENIED_REPLY : NO_SUMMARY_REPLY
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
