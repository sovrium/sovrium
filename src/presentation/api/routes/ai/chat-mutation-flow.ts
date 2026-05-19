/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth-repository'
import { parseMutationIntent } from '@/domain/services/ai-chat-mutation-parser'
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
import type { MutationTable } from '@/domain/services/ai-chat-mutation-parser'

type MutationTableWithPerms = MutationTable & { readonly permissions?: unknown }

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

export interface MutationTurnInput {
  readonly app: App | undefined
  readonly message: string
  readonly userId: string
  readonly userRole: string
  readonly confirmationToken?: string | undefined
}

const toMutationTables = (app: App | undefined): ReadonlyArray<MutationTableWithPerms> =>
  projectAppTables(app, { includeRequired: true })

export const resolveUserEmail = async (userId: string): Promise<string> => {
  const program = Effect.gen(function* () {
    const repo = yield* AuthRepository
    return yield* repo.findUserEmailById(userId)
  })
  const result = await Effect.runPromise(program.pipe(provideAuthRepoLive, Effect.either))
  if (result._tag === 'Left') return userId
  return result.right ?? userId
}

const isAffirmative = (message: string): boolean => /^\s*(yes|y|confirm|ok|sure)\b/i.test(message)
const isNegative = (message: string): boolean => /^\s*(no|n|cancel|stop|nope)\b/i.test(message)

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

export const evaluateMutationTurn = async (
  input: MutationTurnInput
): Promise<MutationTurnResult> => {
  if (input.confirmationToken !== undefined) {
    const stored = consumeConfirmation(input.confirmationToken)
    if (stored !== undefined) {
      if (isNegative(input.message)) return { kind: 'cancelled' }
      if (isAffirmative(input.message)) {
        const outcome = await commitConfirmedMutation(stored)
        return toTurnResult(outcome)
      }
      return { kind: 'cancelled' }
    }
  }

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
