/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The streamed chat turns paused on a question the agent asked (`ask_user`),
 * by question id — what `POST /api/ai/chat/elicitations/:id` goes on with.
 *
 * Process state, like the turns held for an approval: a restart forgets them,
 * and an answer then finds nothing. A question stays open for
 * {@link ELICITATION_TTL_MS}; once answered or past that, it is CLOSED and
 * kept a while as such — without its turn — so its own person is told it can no longer be answered
 * (409) rather than that it does not exist. For anyone else it never exists
 * (404, S1). Bounded, oldest first out.
 */

import { Effect } from 'effect'
import { ELICITATION_TTL_MS } from '@/domain/models/app/agents/ask-user-service'
import {
  MAX_HELD_TURNS,
  rememberHeld,
  type HeldChatTurn,
} from '@/presentation/api/agents/chat-stream-events'
import type { PendingElicitation } from '@/application/ports/services/agent-approval-store'

/** A turn paused on a question: the turn, and the question it waits on. */
export interface HeldChatElicitation extends HeldChatTurn {
  readonly elicitation: PendingElicitation
}

/**
 * A question by its id. An open one keeps its paused turn; a closed one keeps
 * only whose it is — the turn, its conversation and its tools, is dropped the
 * moment the question closes, so a closed record weighs next to nothing.
 */
type Entry =
  | { readonly state: 'open'; readonly held: HeldChatElicitation; readonly expiresAtMs: number }
  | {
      readonly state: 'answered' | 'expired'
      readonly userId: string
      readonly expiresAtMs: number
    }

const elicitations = new Map<string, Entry>()

const ownerOf = (entry: Entry): string =>
  entry.state === 'open' ? entry.held.userId : entry.userId

/**
 * Drop the paused turn of every question past its lifetime, and forget a
 * question altogether once it has been past it as long again — its person
 * then finds nothing (404).
 */
const sweep = (nowMs: number): void => {
  for (const [id, entry] of elicitations) {
    if (nowMs >= entry.expiresAtMs + ELICITATION_TTL_MS) elicitations.delete(id)
    else if (entry.state === 'open' && nowMs >= entry.expiresAtMs) {
      elicitations.set(id, {
        state: 'expired',
        userId: entry.held.userId,
        expiresAtMs: entry.expiresAtMs,
      })
    }
  }
}

/**
 * The question the registry is about to push out to make room, if it is an
 * open one an external MCP server asked: its server is told `cancel`, so the
 * tool call it holds open ends now rather than an hour later.
 */
const releaseOldest = (): void => {
  if (elicitations.size < MAX_HELD_TURNS) return
  const oldest = elicitations.values().next().value
  const relay = oldest?.state === 'open' ? oldest.held.elicitation.relay : undefined
  // Fire and forget: nobody can answer this question any more, and `relay` never fails.
  if (relay !== undefined) void Effect.runPromise(relay({ action: 'cancel' }))
}

/** Remember the turn a question paused. */
export const holdChatElicitation = (held: HeldChatElicitation, nowMs = Date.now()): void => {
  sweep(nowMs)
  releaseOldest()
  rememberHeld(elicitations, held.elicitation.id, {
    state: 'open',
    held,
    expiresAtMs: nowMs + ELICITATION_TTL_MS,
  })
}

/** A question, as one person finds it. */
export type ChatElicitationLookup =
  | { readonly kind: 'none' }
  | { readonly kind: 'closed'; readonly reason: 'answered' | 'expired' }
  | { readonly kind: 'open'; readonly held: HeldChatElicitation }

/** Find question `id` for `userId`: someone else's question is `none`. */
export const findChatElicitation = (
  id: string,
  userId: string,
  nowMs = Date.now()
): ChatElicitationLookup => {
  const entry = elicitations.get(id)
  if (entry === undefined || ownerOf(entry) !== userId) return { kind: 'none' }
  if (entry.state !== 'open') return { kind: 'closed', reason: entry.state }
  if (nowMs >= entry.expiresAtMs) return { kind: 'closed', reason: 'expired' }
  return { kind: 'open', held: entry.held }
}

/**
 * Close question `id` once it is answered. `false` when it was not open —
 * answered meanwhile — so one answer only ever resumes the turn.
 */
export const closeChatElicitation = (id: string): boolean => {
  const entry = elicitations.get(id)
  if (entry === undefined || entry.state !== 'open') return false
  elicitations.set(id, {
    state: 'answered',
    userId: entry.held.userId,
    expiresAtMs: entry.expiresAtMs,
  })
  return true
}
