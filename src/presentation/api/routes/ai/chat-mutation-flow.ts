/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AI Chat record-mutation flow.
 *
 * Bridges the generic `/api/ai/chat` route to the {@link parseMutationIntent}
 * domain parser and the {@link applyMutation} executor — the orchestration
 * layer for `[internal ref]`.
 *
 * A chat turn is a *mutation turn* when either:
 *  - the user message parses to a recognised record-mutation intent, or
 *  - the request carries a `confirmationToken` that resolves to a previously
 *    stashed pending confirmation.
 *
 * `evaluateMutationTurn` returns a {@link MutationTurnResult} describing how
 * the route should respond; a `kind: 'none'` result means the turn is a plain
 * chat turn with no mutation, and the route proceeds as before.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { parseMutationIntent } from '@/domain/services/ai-chat/ai-chat-mutation-parser'
import { provideAuthRepoLive } from '@/presentation/api/routes/ai/effect-runner'
import {
  applyMutation,
  commitConfirmedMutation,
  consumeConfirmation,
  type MutationOutcome,
  type PendingConfirmation,
} from './chat-mutation'
import { projectAppTables } from './chat-table-projection'
import type { ChatAction } from '@/domain/models/api/ai/chat'
import type { App } from '@/domain/models/app'
import type { MutationTable } from '@/domain/services/ai-chat/ai-chat-mutation-parser'

/** Table shape carrying the permissions block needed for RBAC checks. */
type MutationTableWithPerms = MutationTable & { readonly permissions?: unknown }

/** The route-facing result of evaluating a turn for record mutations. */
export type MutationTurnResult =
  | { readonly kind: 'none' }
  | { readonly kind: 'forbidden'; readonly message: string }
  | {
      readonly kind: 'pending'
      readonly pendingConfirmation: PendingConfirmation
    }
  | {
      readonly kind: 'applied'
      readonly actions: ReadonlyArray<ChatAction>
      readonly summary: string
    }
  | { readonly kind: 'validation-error'; readonly message: string }
  | { readonly kind: 'cancelled' }

/** Inputs for evaluating a chat turn against the record-mutation pipeline. */
export interface MutationTurnInput {
  readonly app: App | undefined
  readonly message: string
  /** The acting user's id — resolved to an email for activity attribution. */
  readonly userId: string
  /** The acting user's role — drives table-level RBAC. */
  readonly userRole: string
  /** A confirmation token from the request body, when re-confirming. */
  readonly confirmationToken?: string | undefined
}

/**
 * Project `app.tables[]` onto the minimal mutation-table shape — the shared
 * {@link projectAppTables} projection with the field `required` flag included
 * (the create-payload validator needs it).
 */
const toMutationTables = (app: App | undefined): ReadonlyArray<MutationTableWithPerms> =>
  projectAppTables(app, { includeRequired: true })

/**
 * Resolve a user's email from the `auth.user` table for activity-log
 * attribution. Falls back to the raw user id when the lookup yields nothing
 * (defensive — the chat route is `requireAuth`-gated).
 *
 * Exported so the read-query flow can attribute `ai.chat.query` activity rows
 * to the acting user's email without duplicating the
 * lookup.
 */
export const resolveUserEmail = async (userId: string): Promise<string> => {
  const program = Effect.gen(function* () {
    const repo = yield* AuthRepository
    return yield* repo.findUserEmailById(userId)
  })
  // Defensive: the chat route is `requireAuth`-gated, so a lookup miss / DB
  // error falls back to the raw user id rather than failing the chat turn.
  const result = await Effect.runPromise(program.pipe(provideAuthRepoLive, Effect.either))
  if (result._tag === 'Left') return userId
  return result.right ?? userId
}

/** Affirmative / negative confirmation-reply detection. */
const isAffirmative = (message: string): boolean => /^\s*(yes|y|confirm|ok|sure)\b/i.test(message)
const isNegative = (message: string): boolean => /^\s*(no|n|cancel|stop|nope)\b/i.test(message)

/** Map a {@link MutationOutcome} onto the route-facing {@link MutationTurnResult}. */
const toTurnResult = (outcome: MutationOutcome): MutationTurnResult => {
  switch (outcome.status) {
    case 'forbidden':
      return { kind: 'forbidden', message: outcome.message }
    case 'validation-error':
      return { kind: 'validation-error', message: outcome.message }
    case 'pending':
      return { kind: 'pending', pendingConfirmation: outcome.pendingConfirmation }
    case 'applied':
      return { kind: 'applied', actions: outcome.actions, summary: outcome.summary }
  }
}

/**
 * Evaluate a chat turn for record mutations.
 *
 * Resolution order:
 *  1. A `confirmationToken` that resolves to a stashed confirmation: an
 *     affirmative message commits it; a negative message cancels it.
 *  2. Otherwise, parse the message for a mutation intent and apply it.
 *  3. No mutation intent → `kind: 'none'` (plain chat turn).
 */
export const evaluateMutationTurn = async (
  input: MutationTurnInput
): Promise<MutationTurnResult> => {
  // ── confirmation path ──────────────────────────────────────────────────
  if (input.confirmationToken !== undefined) {
    const stored = consumeConfirmation(input.confirmationToken)
    if (stored !== undefined) {
      if (isNegative(input.message)) return { kind: 'cancelled' }
      if (isAffirmative(input.message)) {
        const outcome = await commitConfirmedMutation(stored)
        return toTurnResult(outcome)
      }
      // Token present but the reply is neither yes nor no — treat as cancelled
      // so a stray token never silently commits a destructive action.
      return { kind: 'cancelled' }
    }
  }

  // ── intent path ────────────────────────────────────────────────────────
  const tables = toMutationTables(input.app)
  if (tables.length === 0) return { kind: 'none' }
  const intent = parseMutationIntent(input.message, tables)
  if (intent === undefined) return { kind: 'none' }

  const userEmail = await resolveUserEmail(input.userId)
  const outcome = await applyMutation({
    intent,
    userRole: input.userRole,
    userEmail,
    tables,
  })
  return toTurnResult(outcome)
}
