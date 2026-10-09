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
import {
  buildCreateAuthorshipOverrides,
  buildUpdateAuthorshipOverrides,
} from '@/domain/models/app/tables/authorship-fields'
import { normalizeDateValuesIn } from '@/domain/models/app/tables/empty-date-service'
import { buildSyntheticSession } from '../build-guest-session'
import { resolveRunAsActor } from './record'
import { admitAttachments } from './record-attachment-gate'
import { callerRefusal, runLinkReader, updatesOf } from './record-caller-gate'
import { createAndAnnounce, recordEventLoopRefusal, updateAndAnnounce } from './record-events'
import { declaredFieldNames, failureFromError, resolveActionTargetIds } from './record-filters'
import { actionAttributes, findMultiSelectViolationMessage, recordProp, stringProp } from './shared'
import type { ActionHandler, ActionOutcome, ActionRunContext } from './shared'
import type { StepRequirements } from '../run/types'
import type { LinkReader } from '@/application/use-cases/tables/linked-row-visibility'
import type { CallerWriteRequest } from '@/application/use-cases/tables/permissions/caller-write-authority'
import type { App } from '@/domain/models/app'

/**
 * Create branch of `record/upsert` — no existing match was found.
 *
 * Single-arg config so the helper stays within the `max-params` budget once the
 * the `runAs: 'triggering-user'` design `actorId` is threaded alongside the table/data/overrides.
 */
const upsertCreate = (config: {
  readonly actorId: string
  readonly app: App
  readonly tableName: string
  readonly data: Readonly<Record<string, unknown>>
  readonly createOverrides: Readonly<Record<string, string>>
  readonly runContext: ActionRunContext | undefined
}): Effect.Effect<ActionOutcome, never, StepRequirements> =>
  Effect.gen(function* () {
    const { actorId, app, tableName, data, createOverrides, runContext } = config
    const loop = recordEventLoopRefusal(runContext, tableName, 'create')
    if (loop !== undefined) return loop
    const created = yield* Effect.result(
      createAndAnnounce({
        session: buildSyntheticSession(actorId),
        app,
        tableName,
        fields: { ...data, ...createOverrides },
        runContext,
      })
    )
    if (created._tag === 'Failure') return failureFromError(created.failure)
    return { status: 'success', output: { operation: 'created', id: created.success.id } } as const
  })

/**
 * Update branch of `record/upsert` — one or more rows matched.
 *
 * Single-arg config so the helper stays within the `max-params` budget once the
 * the `runAs: 'triggering-user'` design `actorId` is threaded alongside the table/matchedIds/data/overrides.
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
}): Effect.Effect<ActionOutcome, never, StepRequirements> =>
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
      : ({
          status: 'success',
          output: { operation: 'updated', id: String(matchedIds[0]) },
        } as const)
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
    if (multiSelectError) return { status: 'failure', error: multiSelectError } as const

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
    const requests = upsertWrites(tableName, matchedIds, data)
    const refused = yield* callerRefusal(app, automation, requests)
    if (refused !== undefined) return refused

    // `runAs: 'triggering-user'` attributes both branches (`created-by`, `updated-by`)
    // to the triggering user when one exists, else the system actor; the files
    // the step attaches are judged for that same writer.
    const actorId = resolveRunAsActor(props, automation)
    const admitted = yield* admitAttachments({
      ...{ app, actorId, tableName, values: data, requests, written: automation.writtenFiles },
    })
    if (admitted.status === 'failure') return admitted
    const { values } = admitted

    return matchedIds.length === 0
      ? yield* upsertCreate({
          actorId,
          app,
          tableName,
          data: normalizeDateValuesIn(app.tables, tableName, values),
          createOverrides: buildCreateAuthorshipOverrides(app.tables, tableName, actorId),
          runContext,
        })
      : yield* upsertUpdate({
          actorId,
          tableName,
          matchedIds,
          data: values,
          updateOverrides: buildUpdateAuthorshipOverrides(app.tables, tableName, actorId),
          runContext,
          app,
          linkReader: yield* runLinkReader(automation),
        })
  }).pipe(
    Effect.withSpan('automations.handle-record-upsert', { attributes: actionAttributes(action) })
  )
