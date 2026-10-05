/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `record/upsert` — update the rows a filter matches, or create one when none
 * does. Split from `record.ts` so each module stays inside the size limit; the
 * two branches start the record automations of their table as the create and
 * update handlers do.
 */

import { Effect } from 'effect'
import { createRecordProgram } from '@/application/use-cases/tables/write-record-programs'
import {
  buildCreateAuthorshipOverrides,
  buildUpdateAuthorshipOverrides,
} from '@/domain/models/app/tables/authorship-fields'
import { normalizeDateValuesIn } from '@/domain/models/app/tables/empty-date-service'
import { buildSyntheticSession } from '../build-guest-session'
import { resolveRunAsActor } from './record'
import { callerRefusal, runLinkReader, updatesOf } from './record-caller-gate'
import {
  announceRecordWrite,
  flattenWrittenRecord,
  recordEventLoopRefusal,
  updateAndAnnounce,
} from './record-events'
import { declaredFieldNames, failureFromError, resolveActionTargetIds } from './record-filters'
import { actionAttributes, findMultiSelectViolationMessage, recordProp, stringProp } from './shared'
import type { ActionHandler, ActionOutcome, ActionRunContext } from './shared'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import type { LinkReader } from '@/application/use-cases/tables/linked-row-visibility'
import type { CallerWriteRequest } from '@/application/use-cases/tables/permissions/caller-write-authority'
import type { App } from '@/domain/models/app'

/**
 * Create branch of `record/upsert` — no existing match was found.
 *
 * Single-arg config so the helper stays within the `max-params` budget once the
 * [internal ref] `actorId` is threaded alongside the table/data/overrides.
 */
const upsertCreate = (config: {
  readonly actorId: string
  readonly tableName: string
  readonly data: Readonly<Record<string, unknown>>
  readonly createOverrides: Readonly<Record<string, string>>
  readonly runContext: ActionRunContext | undefined
}): Effect.Effect<ActionOutcome, never, TableRepository | DataSourceRepository | AuthRepository> =>
  Effect.gen(function* () {
    const { actorId, tableName, data, createOverrides, runContext } = config
    const loop = recordEventLoopRefusal(runContext, tableName, 'create')
    if (loop !== undefined) return loop
    const created = yield* Effect.result(
      createRecordProgram({
        session: buildSyntheticSession(actorId),
        tableName,
        fields: { ...data, ...createOverrides },
      })
    )
    if (created._tag === 'Failure') return failureFromError(created.failure)
    const record = flattenWrittenRecord(created.success)
    yield* announceRecordWrite(runContext, { tableName, event: 'create', record })
    return { status: 'success', output: { operation: 'created', id: record['id'] } } as const
  })

/**
 * Update branch of `record/upsert` — one or more rows matched.
 *
 * Single-arg config so the helper stays within the `max-params` budget once the
 * [internal ref] `actorId` is threaded alongside the table/matchedIds/data/overrides.
 */
const upsertUpdate = (config: {
  readonly actorId: string
  readonly tableName: string
  readonly matchedIds: readonly string[]
  readonly data: Readonly<Record<string, unknown>>
  readonly updateOverrides: Readonly<Record<string, string>>
  readonly runContext: ActionRunContext | undefined
  readonly app: App
  readonly linkReader: LinkReader | undefined
}): Effect.Effect<ActionOutcome, never, TableRepository | DataSourceRepository | AuthRepository> =>
  Effect.gen(function* () {
    const { actorId, tableName, matchedIds, data, updateOverrides, runContext } = config
    const { app, linkReader } = config
    const loop = recordEventLoopRefusal(runContext, tableName, 'update', Object.keys(data))
    if (loop !== undefined) return loop
    const session = buildSyntheticSession(actorId)
    const fields = { ...data, ...updateOverrides }
    const updates = yield* Effect.result(
      Effect.forEach(
        matchedIds,
        (recordId) =>
          updateAndAnnounce({ session, tableName, recordId, fields, runContext, app, linkReader }),
        { discard: true }
      )
    )
    return updates._tag === 'Failure'
      ? failureFromError(updates.failure)
      : ({ status: 'success', output: { operation: 'updated' } } as const)
  })

/** The writes an upsert is about to make: one create, or one update per matched row. */
const upsertWrites = (
  tableName: string,
  matchedIds: readonly string[],
  data: Readonly<Record<string, unknown>>
): readonly CallerWriteRequest[] =>
  matchedIds.length === 0
    ? [{ op: 'create', tableName, fields: data }]
    : updatesOf(tableName, matchedIds, data)

export const handleRecordUpsert: ActionHandler = (action, app, automation, runContext) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const tableName = stringProp(props, 'table')
    const data = recordProp(props, 'data') ?? recordProp(props, 'fields') ?? {}

    if (!tableName) {
      return { status: 'failure', error: 'record.upsert requires a table name' } as const
    }

    // Multi-select membership + cardinality — see `handleRecordCreate`. Checked
    // once here rather than inside `upsertCreate`/`upsertUpdate`: `data` is the
    // same payload on both branches, and neither branch receives `app`.
    const multiSelectError = findMultiSelectViolationMessage(app, tableName, data)
    if (multiSelectError) {
      return { status: 'failure', error: multiSelectError } as const
    }

    // Lenient lookup — pre-existing behaviour, preserved explicitly. Note this
    // is the sharpest of the four lenient sites: a failed query reads as "no
    // existing row", so the upsert takes its CREATE branch and every retry
    // duplicates. See `resolveIdsByFilterLenient`. An unresolvable filter field
    // is refused outright rather than degraded into that create branch.
    const targets = yield* resolveActionTargetIds({
      operator: 'record.upsert',
      tableName,
      filter: props['filter'],
      declaredFields: declaredFieldNames(app, tableName),
      idFastPath: stringProp(props, 'id'),
    })
    if (!targets.resolved) return targets.outcome
    const matchedIds: readonly string[] = targets.ids
    const refused = yield* callerRefusal(app, automation, upsertWrites(tableName, matchedIds, data))
    if (refused !== undefined) return refused

    // Actor authority: `runAs: 'triggering-user'` attributes both
    // branches — create-branch `created-by` and update-branch `updated-by` —
    // to the triggering user when one exists, else the system actor.
    const actorId = resolveRunAsActor(props, automation)

    return matchedIds.length === 0
      ? yield* upsertCreate({
          actorId,
          tableName,
          data: normalizeDateValuesIn(app.tables, tableName, data),
          createOverrides: buildCreateAuthorshipOverrides(app.tables, tableName, actorId),
          runContext,
        })
      : yield* upsertUpdate({
          actorId,
          tableName,
          matchedIds,
          data,
          updateOverrides: buildUpdateAuthorshipOverrides(app.tables, tableName, actorId),
          runContext,
          app,
          linkReader: yield* runLinkReader(automation),
        })
  }).pipe(
    Effect.withSpan('automations.handle-record-upsert', { attributes: actionAttributes(action) })
  )
