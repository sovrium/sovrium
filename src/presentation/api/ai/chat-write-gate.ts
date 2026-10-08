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
import {
  createRecordWithSideEffects,
  deleteRecordWithSideEffects,
  updateRecordWithSideEffects,
} from '@/application/use-cases/tables/record-write-roads'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { logError } from '@/infrastructure/logging/logger'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import { readScopeOf, resolveChatRowScope } from './chat-read-scope'
import type { App } from '@/domain/models/app'
import type { DomainContext } from '@/infrastructure/logging/request-effect'

/** The acting user, as a chat write knows her. */
export interface ChatWriter {
  readonly services: DomainContext
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
const readableCandidateIds = async (
  writer: ChatWriter,
  tableName: string,
  filter: ChatWriteTarget['filter']
): Promise<readonly string[]> => {
  const scope = await resolveChatRowScope(writer.services, writer.app, tableName, {
    role: writer.userRole,
    groups: writer.userGroups,
    accessRoles: writer.userAccessRoles,
    userId: writer.userId,
  })
  if (scope.kind === 'refused' || scope.kind === 'nothing') return []
  const readScope = readScopeOf(scope)
  const program = Effect.gen(function* () {
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
  return Effect.runPromise(program.pipe(Effect.provide(writer.services)))
}

/** The request the records write gate judges for one candidate row. */
const requestFor = (tableName: string, write: ChatWrite, recordId: string): CallerWriteRequest =>
  write.op === 'update'
    ? { op: 'update', tableName, recordId, change: write.change }
    : { op: 'delete', tableName, recordId }

/**
 * The ids of the rows of `tableName` that `write` may reach for `writer` (see
 * the module header). Empty when she may reach none.
 */
export const admittedWriteIds = async (
  writer: ChatWriter,
  tableName: string,
  write: ChatWrite,
  target: ChatWriteTarget
): Promise<readonly string[]> => {
  const candidates =
    target.recordId !== undefined
      ? [String(target.recordId)]
      : await readableCandidateIds(writer, tableName, target.filter)
  if (candidates.length === 0) return []
  const verdicts = await Effect.runPromise(
    authorizeCallerWrites(
      writer.app,
      buildSyntheticSession(writer.userId),
      tableName,
      candidates.map((id) => requestFor(tableName, write, id))
    ).pipe(Effect.provide(writer.services))
  )
  return candidates.filter((_, index) => verdicts[index] === true)
}

/** The user a chat commit writes as: the one who asked, with her role and groups. */
export type ChatCaller = Pick<ChatWriter, 'services' | 'app' | 'userId' | 'userRole' | 'userGroups'>

/** What every chat write hands its write road about the user who asked. */
const callerOf = (caller: ChatCaller) => {
  const session = buildSyntheticSession(caller.userId)
  return {
    session,
    app: caller.app,
    userRole: caller.userRole,
    userGroups: caller.userGroups,
    linkReader: { session, role: caller.userRole, groups: caller.userGroups },
    processEnv: process.env,
  }
}

/** Create one record as the caller, through the records API's create road; resolves its id. */
export const commitChatCreate = async (
  caller: ChatCaller,
  tableName: string,
  data: Readonly<Record<string, unknown>>
): Promise<string> => {
  const created = await Effect.runPromise(
    createRecordWithSideEffects({
      ...callerOf(caller),
      tableName,
      fields: data,
      isSqlite: isSqliteRuntime(),
    }).pipe(Effect.provide(caller.services))
  )
  return created.id
}

/**
 * Write `change` onto each admitted row, one update at a time, as the caller;
 * resolves the ids written. A row that cannot be written (moved to the trash
 * since it was admitted, refused by the database) is left as it is, logged.
 */
export const commitChatUpdate = async (
  caller: ChatCaller,
  tableName: string,
  ids: readonly string[],
  change: Readonly<Record<string, unknown>>
): Promise<readonly string[]> => {
  const outcomes = await Effect.runPromise(
    Effect.forEach(ids, (recordId) =>
      updateRecordWithSideEffects({
        ...callerOf(caller),
        ...{ tableName, recordId, fields: change },
        isSqlite: isSqliteRuntime(),
        forgetDerivedVariants: evictTransformCacheForKey,
      }).pipe(
        Effect.map((written) => (written === undefined ? undefined : recordId)),
        Effect.tapCause((cause) =>
          Effect.sync(() => {
            logError('[ai-chat] updating a record failed', cause, { table: tableName })
          })
        ),
        // effect-swallow: one row that cannot be written must not stop the others; it stays as it was and is not reported updated.
        Effect.orElseSucceed(() => undefined)
      )
    ).pipe(Effect.provide(caller.services))
  )
  return outcomes.filter((id): id is string => id !== undefined)
}

/**
 * Move the admitted rows to the trash, as the records API's delete does, on
 * behalf of the caller; resolves the ids trashed. A row that cannot be trashed
 * (already in the trash, held by a restrict link) is left as it is, logged.
 */
export const commitChatDelete = async (input: {
  readonly caller: ChatCaller
  readonly tableName: string
  readonly ids: readonly string[]
}): Promise<readonly string[]> => {
  const { caller, tableName, ids } = input
  const { session, app, processEnv } = callerOf(caller)
  const outcomes = await Effect.runPromise(
    Effect.forEach(ids, (recordId) =>
      deleteRecordWithSideEffects({
        ...{ session, app, tableName, recordId, processEnv },
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
    ).pipe(Effect.provide(caller.services))
  )
  return outcomes.filter((id): id is string => id !== undefined)
}
