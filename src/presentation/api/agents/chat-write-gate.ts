/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The chat write gate: which rows an AI-driven update or delete may reach for
 * the user who asked for it, and the three commits a chat turn writes through.
 *
 * ONE gate for every chat write door — an update by id, a bulk update, a
 * (filtered) delete — and for the number a confirmation prompt quotes:
 *
 *  1. the candidate rows are the ones a chat read shows her
 *     (`resolveChatRowScope` + `readScopeOf`: the table's read grant over her
 *     effective roles, her row-level `read` rule, the live rows only), or the
 *     one row an update names;
 *  2. each candidate is judged by the records API's own write gate for a named
 *     caller (`authorizeCallerWrites`): the table's grant for the operation,
 *     the row as it stands under `read.when` AND `write.when` / `delete.when`,
 *     the row as an update would leave it under `write.when`, and the field
 *     write audiences. A row in the trash is answered as missing.
 *
 * The admitted ids are what a write reaches: the confirmation counts them, the
 * confirmed commit writes them, so the number quoted and the rows written can
 * never disagree.
 *
 * Every commit goes through the records API's one write road for its
 * operation, as the user who asked: a create through
 * `createRecordWithSideEffects`, an update through `updateRecordWithSideEffects`
 * once per admitted row, a delete through `deleteRecordWithSideEffects` once
 * per admitted row — to the trash, never a hard `DELETE`. So a record the
 * assistant writes carries what the same write through the records API
 * carries: its validation and authorship stamps, its activity entry, the
 * table's record automations and its webhooks, one event per row.
 */

import { Effect } from 'effect'
import {
  countDynamicRecords,
  listDynamicRecords,
} from '@/application/use-cases/ai/dynamic-record-query'
import { buildSyntheticSession } from '@/application/use-cases/automations/build-guest-session'
import {
  authorizeCallerWrites,
  type CallerWriteRequest,
} from '@/application/use-cases/tables/permissions/caller-write-authority'
import { recordWriteRequester } from '@/application/use-cases/tables/record-create-orchestration'
import {
  createRecordWithSideEffects,
  deleteRecordWithSideEffects,
  updateRecordWithSideEffects,
} from '@/application/use-cases/tables/record-write-roads'
import {
  isBusinessRuleViolationError,
  type BusinessRuleViolationError,
} from '@/domain/errors/business-rule-violation-error'
import { logError } from '@/infrastructure/logging/logger'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import { readScopeOf, resolveChatRowScope } from './chat-read-scope'
import type { App } from '@/domain/models/app'

/** The acting user, as a chat write knows her. */
export interface ChatWriter {
  readonly app: App
  readonly userId: string
  readonly userRole: string
  readonly userGroups: readonly string[]
  readonly userAccessRoles: readonly string[]
}

/** The write a chat turn asks for: an update carrying its change, or a delete. */
export type ChatWrite =
  | { readonly op: 'update'; readonly change: Readonly<Record<string, unknown>> }
  | { readonly op: 'delete' }

/** Which rows of the table the write names: one by id, or every row matching a filter. */
export interface ChatWriteTarget {
  readonly recordId?: number | undefined
  readonly filter?: { readonly column: string; readonly value: string } | undefined
}

/** Every candidate id a chat read shows `writer` in `tableName`, narrowed by `filter`. */
const readableCandidateIds = (
  writer: ChatWriter,
  tableName: string,
  filter: ChatWriteTarget['filter']
) =>
  Effect.gen(function* () {
    const scope = yield* resolveChatRowScope(writer.app, tableName, {
      role: writer.userRole,
      groups: writer.userGroups,
      accessRoles: writer.userAccessRoles,
      userId: writer.userId,
    })
    if (scope.kind === 'refused' || scope.kind === 'nothing') return []
    const readScope = readScopeOf(scope)
    const total = yield* countDynamicRecords({ table: tableName, filter, ...readScope })
    if (total === 0) return []
    const rows = yield* listDynamicRecords({
      table: tableName,
      columns: ['id'],
      filter,
      limit: total,
      ...readScope,
    })
    return rows.map((row) => String(row['id']))
  })

/** The request the records write gate judges for one candidate row. */
const requestFor = (tableName: string, write: ChatWrite, recordId: string): CallerWriteRequest =>
  write.op === 'update'
    ? { op: 'update', tableName, recordId, change: write.change }
    : { op: 'delete', tableName, recordId }

/**
 * The ids of the rows of `tableName` that `write` may reach for `writer` (see
 * the module header). Empty when she may reach none.
 */
export const admittedWriteIds = (
  writer: ChatWriter,
  tableName: string,
  write: ChatWrite,
  target: ChatWriteTarget
) =>
  Effect.gen(function* () {
    const candidates: readonly string[] =
      target.recordId !== undefined
        ? [String(target.recordId)]
        : yield* readableCandidateIds(writer, tableName, target.filter)
    if (candidates.length === 0) return candidates
    const verdicts = yield* authorizeCallerWrites(
      writer.app,
      buildSyntheticSession(writer.userId),
      tableName,
      candidates.map((id) => requestFor(tableName, write, id))
    )
    return candidates.filter((_, index) => verdicts[index] === true)
  })

/** The user a chat commit writes as: the one who asked, with her role and groups. */
export type ChatCaller = Pick<ChatWriter, 'app' | 'userId' | 'userRole' | 'userGroups'>

/** What every chat write hands its write road about the user who asked. */
const callerOf = (caller: ChatCaller) => {
  const session = buildSyntheticSession(caller.userId)
  return {
    session,
    app: caller.app,
    userRole: caller.userRole,
    userGroups: caller.userGroups,
    requester: recordWriteRequester(session.userId, caller.userRole),
    linkReader: { session, role: caller.userRole, groups: caller.userGroups },
  }
}

/** A summary followed by the rule's message, when a business rule refused a row. */
export const withRuleRefusal = (summary: string, ruleRefusal: string | undefined): string =>
  ruleRefusal === undefined ? summary : `${summary} ${ruleRefusal}`

/**
 * What a chat create wrote: the new record's id, or — when one of the table's
 * business rules refused it — what the assistant tells the user: that nothing
 * was created, and the rule's message, the app author's own sentence, as it
 * does for an update.
 */
export type ChatCreateResult =
  | { readonly kind: 'created'; readonly id: string }
  | { readonly kind: 'refused'; readonly message: string }

/**
 * Settle a create into `tableName` as a chat turn reports it: a business
 * rule's refusal is an answer, not a fault; any other failure still fails the
 * turn.
 */
export const settleChatCreate = <E, R>(
  tableName: string,
  create: Effect.Effect<{ readonly id: string }, E, R>
): Effect.Effect<ChatCreateResult, E, R> =>
  create.pipe(
    Effect.map((created): ChatCreateResult => ({ kind: 'created', id: created.id })),
    Effect.catchIf(
      (error: E): error is E & BusinessRuleViolationError => isBusinessRuleViolationError(error),
      (refusal) =>
        Effect.succeed<ChatCreateResult>({
          kind: 'refused',
          message: withRuleRefusal(`No record was created in "${tableName}".`, refusal.message),
        })
    )
  )

/** Create one record as the caller, through the records API's create road. */
export const commitChatCreate = (
  caller: ChatCaller,
  tableName: string,
  data: Readonly<Record<string, unknown>>
) =>
  settleChatCreate(
    tableName,
    createRecordWithSideEffects({
      ...callerOf(caller),
      tableName,
      fields: data,
    })
  )

/**
 * What a chat update wrote: the ids written and, when a row was refused by one
 * of the table's business rules, the first such rule's message — the app
 * author's own sentence, which the assistant repeats to the user.
 */
export interface ChatUpdateResult {
  readonly written: readonly string[]
  readonly ruleRefusal?: string
}

/** One row's update as the chat commit settles it: written, refused by a rule, or left. */
type RowUpdate =
  | { readonly kind: 'written'; readonly id: string }
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'left' }

/**
 * Write `change` onto each admitted row, one update at a time, as the caller.
 * A row a business rule refuses is left as it is and its rule's message is
 * reported; a row that cannot be written for another reason (moved to the
 * trash since it was admitted, refused by the database) is left as it is,
 * logged.
 */
export const commitChatUpdate = (
  caller: ChatCaller,
  tableName: string,
  ids: readonly string[],
  change: Readonly<Record<string, unknown>>
) =>
  Effect.forEach(ids, (recordId) =>
    updateRecordWithSideEffects({
      ...callerOf(caller),
      ...{ tableName, recordId, fields: change },
      forgetDerivedVariants: evictTransformCacheForKey,
    }).pipe(
      Effect.map((written): RowUpdate =>
        written === undefined ? { kind: 'left' } : { kind: 'written', id: recordId }
      ),
      // A rule's refusal is an answer, not a fault: the user is told why.
      Effect.catchIf(isBusinessRuleViolationError, (refusal) =>
        Effect.succeed<RowUpdate>({ kind: 'refused', message: refusal.message })
      ),
      Effect.tapCause((cause) =>
        Effect.sync(() => {
          logError('[ai-chat] updating a record failed', cause, { table: tableName })
        })
      ),
      // effect-swallow: one row that cannot be written must not stop the others; it stays as it was and is not reported updated.
      Effect.orElseSucceed((): RowUpdate => ({ kind: 'left' }))
    )
  ).pipe(
    Effect.map((outcomes): ChatUpdateResult => {
      const written = outcomes.flatMap((row) => (row.kind === 'written' ? [row.id] : []))
      const refusal = outcomes.find((row) => row.kind === 'refused')
      return refusal?.kind === 'refused' ? { written, ruleRefusal: refusal.message } : { written }
    })
  )

/**
 * Move the admitted rows to the trash, as the records API's delete does, on
 * behalf of the caller; resolves the ids trashed. A row that cannot be trashed
 * (already in the trash, held by a restrict link) is left as it is, logged.
 */
export const commitChatDelete = (input: {
  readonly caller: ChatCaller
  readonly tableName: string
  readonly ids: readonly string[]
}) => {
  const { caller, tableName, ids } = input
  const { session, app, requester, userGroups } = callerOf(caller)
  return Effect.forEach(ids, (recordId) =>
    deleteRecordWithSideEffects({
      ...{ session, app, tableName, recordId, requester, userGroups },
      mode: 'soft',
      forgetDerivedVariants: evictTransformCacheForKey,
    }).pipe(
      Effect.map((result) => (result.success ? recordId : undefined)),
      Effect.tapCause((cause) =>
        Effect.sync(() => {
          logError('[ai-chat] moving a record to the trash failed', cause, { table: tableName })
        })
      ),
      // effect-swallow: one row that cannot be trashed must not stop the others; it stays as it was and is not reported deleted.
      Effect.orElseSucceed(() => undefined)
    )
  ).pipe(Effect.map((outcomes) => outcomes.filter((id): id is string => id !== undefined)))
}
