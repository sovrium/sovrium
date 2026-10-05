/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The record handlers' side of the record-event channel: a record a
 * step writes starts the record automations of its table, as the same write
 * through the records API does. See `run/record-event-channel.ts` for the
 * depth limit and the background dispatch.
 */

import { Effect } from 'effect'
import { rawGetRecordProgram } from '@/application/use-cases/tables/read-record-programs'
import { deleteRecordProgram } from '@/application/use-cases/tables/record-lifecycle-programs'
import { updateRecordProgram } from '@/application/use-cases/tables/write-record-programs'
import { logError } from '@/infrastructure/logging/logger'
import type { buildSyntheticSession, buildSystemSession } from '../build-guest-session'
import type { ActionOutcome, ActionRunContext, RecordWriteEvent } from './shared'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import type { LinkReader } from '@/application/use-cases/tables/linked-row-visibility'
import type { App } from '@/domain/models/app'

/** A failed step when this write would pass the record-event depth limit. */
export const recordEventLoopRefusal = (
  runContext: ActionRunContext | undefined,
  tableName: string,
  event: RecordWriteEvent['event'],
  fields?: readonly string[]
): ActionOutcome | undefined => {
  const reason = runContext?.recordEvents?.refusal(tableName, event, fields)
  return reason === undefined ? undefined : { status: 'failure', error: reason }
}

/** Start the record automations of a write the step made. */
export const announceRecordWrite = (
  runContext: ActionRunContext | undefined,
  write: RecordWriteEvent
): Effect.Effect<void> =>
  Effect.sync(() => runContext?.recordEvents?.dispatch(write)).pipe(
    Effect.withSpan('automations.announce-record-write')
  )

/** A written record as the triggers read it: its id beside its fields. */
export const flattenWrittenRecord = (
  written: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const nested = written['fields']
  return nested !== null && typeof nested === 'object'
    ? { id: written['id'], ...(nested as Record<string, unknown>) }
    : written
}

/**
 * The record as it stood BEFORE a write, when a record automation watches the
 * event — the update trigger's `watchFields` compare against it, and a delete
 * trigger reads it. `undefined` when nothing watches, so an unwatched write
 * pays no extra read.
 */
export const readBeforeWrite = (input: {
  readonly runContext: ActionRunContext | undefined
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly recordId: string
  readonly event: RecordWriteEvent['event']
}): Effect.Effect<Readonly<Record<string, unknown>> | undefined, never, TableRepository> =>
  Effect.gen(function* () {
    if (input.runContext?.recordEvents?.watches(input.tableName, input.event) !== true) {
      return undefined
    }
    const row = yield* rawGetRecordProgram(input.session, input.tableName, input.recordId).pipe(
      // Logged BEFORE the swallow (E6): a failed read changes which update
      // automations start, and that must not happen without a trace.
      Effect.tapCause((cause) =>
        Effect.sync(() => {
          logError('[automation:record-event] previous row not read before a write', cause, {
            'sovrium.table': input.tableName,
          })
        })
      ),
      // effect-swallow: the previous row only NARROWS which automations the event starts; a failed read dispatches as a first write rather than failing the step that already has to write.
      Effect.orElseSucceed(() => undefined)
    )
    return row ?? undefined
  }).pipe(Effect.withSpan('automations.read-before-write'))

/** Update one record, then start the update automations of its table. */
export const updateAndAnnounce = (input: {
  readonly session: ReturnType<typeof buildSyntheticSession>
  readonly tableName: string
  readonly recordId: string
  readonly fields: Readonly<Record<string, unknown>>
  readonly runContext: ActionRunContext | undefined
  /**
   * The app, so a many-to-many field is written to its junction the way the
   * records API writes it — it has no base column to update.
   */
  readonly app?: App
  /** Who a cleared many-to-many field is cleared for; absent, every link goes. */
  readonly linkReader?: LinkReader
}): Effect.Effect<
  void,
  Effect.Error<ReturnType<typeof updateRecordProgram>>,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const { session, tableName, recordId, fields, runContext, app, linkReader } = input
    const previousRecord = yield* readBeforeWrite({ ...input, event: 'update' })
    const updated = yield* updateRecordProgram(session, tableName, recordId, {
      fields,
      app,
      linkReader,
    })
    // [internal ref]: an automation's update starts the update automations of its table.
    yield* announceRecordWrite(runContext, {
      tableName,
      event: 'update',
      record: flattenWrittenRecord(updated),
      ...(previousRecord === undefined ? {} : { previousRecord }),
    })
  }).pipe(Effect.withSpan('automations.update-and-announce'))

/** Delete one record, then start the delete automations of its table. */
export const deleteAndAnnounce = (input: {
  readonly session: ReturnType<typeof buildSystemSession>
  readonly tableName: string
  readonly recordId: string
  readonly runContext: ActionRunContext | undefined
}): Effect.Effect<void, Effect.Error<ReturnType<typeof deleteRecordProgram>>, TableRepository> =>
  Effect.gen(function* () {
    const { session, tableName, recordId, runContext } = input
    const previous = yield* readBeforeWrite({ ...input, event: 'delete' })
    const deleted = yield* deleteRecordProgram(session, tableName, recordId)
    // [internal ref]: a delete trigger reads the record as it stood before — and fires
    // only when a row was actually removed, as the records API's does.
    if (previous !== undefined && deleted.success && !deleted.restrictViolation) {
      yield* announceRecordWrite(runContext, { tableName, event: 'delete', record: previous })
    }
  }).pipe(Effect.withSpan('automations.delete-and-announce'))
