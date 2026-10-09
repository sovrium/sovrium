/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  buildCreateAuthorshipOverrides,
  buildUpdateAuthorshipOverrides,
} from '@/domain/models/app/tables/authorship-fields'
import { normalizeDateValuesIn } from '@/domain/models/app/tables/empty-date-service'
import { buildSyntheticSession } from '../build-guest-session'
import { admitAttachments, type AttachmentAdmission } from './record-attachment-gate'
import { failed, batchOutcome, runBatchItems } from './record-batch-loop'
import {
  CALLER_REFUSAL,
  callerMayWrite,
  callerRefusal,
  runLinkReader,
  updatesOf,
  writerActorOf,
} from './record-caller-gate'
import { automationCreateFields } from './record-create-fields'
import { createAndAnnounce, recordEventLoopRefusal, updateAndAnnounce } from './record-events'
import { declaredFieldNames, errorMessageOf, resolveActionTargetIds } from './record-filters'
import { resolveOwnProps } from './run-context-resolution'
import { actionAttributes, findMultiSelectViolationMessage, stringProp } from './shared'
import type { ItemResult } from './record-batch-loop'
import type { ActionHandler, ActionOutcome, ActionRunContext, AutomationContext } from './shared'
import type { StepRequirements } from '../run/types'
import type { CallerWriteRequest } from '@/application/use-cases/tables/permissions/caller-write-authority'
import type { App } from '@/domain/models/app'

/** What an item needs: the step's services, which every write road runs on. */
export type GateRequirements = StepRequirements

/**
 * The `record` batch operators: `batchCreate`, `batchUpdate`, `batchDelete` and
 * `batchUpsert`.
 *
 * ── Why these loop the single-record write roads ─────────────────────────────
 *
 * Each item is written through the records API's single-record write road for
 * its operation (`record-events.ts`), exactly as the single-record operators
 * write: the same permission / audit / cascade pipeline, the table's webhooks,
 * and — through the run's record-event channel, under its depth limit — the
 * table's record automations, one event per row written.
 *
 * ── continueOnItemError: ONE rule, one implementation ────────────────────────
 *
 * All three item-array operators declare the flag with byte-identical wording —
 * "Continue processing remaining items if one fails (default: false)" — so the
 * default STOPS at the first failing item rather than attempting the rest and
 * reporting afterwards. That matters for a batch of writes: a run that is going
 * to abort anyway should not keep committing rows past the failure.
 *
 * `batchCreate` runs on the same shared `runBatchItems` loop rather than its
 * own: a copy that attempts every item regardless and only uses the flag for
 * the STEP's final status would contradict the published annotation, and three
 * copies of one rule is how such a divergence arises. `continueOnItemError:
 * true` still attempts every item.
 *
 * -BATCHUPDATE-001..003, -BATCHDELETE-001..003, -BATCHUPSERT-001..003
 * (+ REGRESSION).
 */

/** A batch operator's resolved `props` bag — read-only at every use site here. */
export type BatchProps = Readonly<Record<string, unknown>>

/**
 * Resolve the action's props from the AUTHORED action (or take them as given
 * when they are final — see `resolveOwnProps`).
 *
 * The run loop's `resolveTriggerInValue` pass rewrites every STRING leaf through
 * the template engine, so `items: '{{trigger.data.items}}'` — a string leaf
 * pointing at an ARRAY — reaches the handler as rendered text and iterates as
 * zero items. `resolveRunContextValue` instead unwraps a whole-string `{{path}}`
 * to the VALUE at that path, arrays intact. Shared by all four operators.
 */
export const resolvedProps = (
  action: BatchProps,
  runContext: Parameters<ActionHandler>[3]
): BatchProps =>
  runContext
    ? (resolveOwnProps(runContext) as Record<string, unknown>)
    : ((action['props'] as Record<string, unknown> | undefined) ?? {})

/**
 * The declared item array. `records` is documented as an alias of `items`
 * (batchCreate declares both; the others only `items`), so `items` wins when a
 * config improbably sets both — matching the schema's own framing rather than
 * the alias.
 */
const itemsOf = (props: BatchProps): readonly unknown[] => {
  const raw = props['items'] ?? props['records']
  return Array.isArray(raw) ? (raw as readonly unknown[]) : []
}

export const asRecord = (value: unknown): BatchProps | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined

/**
 * An item's write judged: the caller gate first, then the attachment rules for
 * the writer the batch writes as, which also store its inline files.
 */
const itemAdmission = (input: {
  readonly app: App
  readonly automation: AutomationContext
  readonly tableName: string
  readonly values: Readonly<Record<string, unknown>>
  readonly requests: readonly CallerWriteRequest[]
}): Effect.Effect<AttachmentAdmission, never, GateRequirements> =>
  Effect.gen(function* () {
    const refused = yield* callerRefusal(input.app, input.automation, input.requests)
    if (refused !== undefined) return { status: 'failure', error: refused.error } as const
    const { automation } = input
    return yield* admitAttachments({
      ...{ ...input, actorId: writerActorOf(automation), written: automation.writtenFiles },
    })
  })

// ---------------------------------------------------------------------------
// record/batchCreate
// ---------------------------------------------------------------------------

const createItem = (input: {
  readonly item: unknown
  readonly tableName: string
  readonly session: ReturnType<typeof buildSyntheticSession>
  readonly authorship: Readonly<Record<string, string>>
  readonly app: App
  readonly automation: AutomationContext
  readonly runContext: ActionRunContext | undefined
}): Effect.Effect<ItemResult, never, GateRequirements> =>
  Effect.gen(function* () {
    const { item, tableName, session, authorship, app, automation, runContext } = input
    // A non-object item degrades to "no fields" rather than failing, preserving
    // the operator's original leniency; the create itself then fails on any
    // required column, which is where the operator's error belongs.
    const fields = asRecord(item) ?? {}

    // Multi-select membership + cardinality, reported per ITEM so
    // `continueOnItemError` keeps its documented meaning and the run history
    // names the offending row. `createRecordProgram` cannot host this check —
    // it takes `app` optionally and this caller passes none.
    const multiSelectError = findMultiSelectViolationMessage(app, tableName, fields)
    if (multiSelectError) return failed(multiSelectError)
    const loop = recordEventLoopRefusal(runContext, tableName, 'create')
    if (loop !== undefined) return failed(loop.error ?? 'record-event loop')
    const requests = [{ op: 'create', tableName, fields }] as const
    const admitted = yield* itemAdmission({ app, automation, tableName, values: fields, requests })
    if (admitted.status === 'failure') return failed(admitted.error)

    const created = yield* Effect.result(
      createAndAnnounce({
        session,
        app,
        tableName,
        fields: { ...normalizeDateValuesIn(app.tables, tableName, admitted.values), ...authorship },
        runContext,
      })
    )
    return created._tag === 'Failure'
      ? failed(errorMessageOf(created.failure))
      : ({ kind: 'created' } as const)
  })

/**
 * `record/batchCreate` — create many rows in one table from a template-resolved
 * array. Accepts `items` or its `records` alias.
 *
 * Runs on the same `runBatchItems` loop as its siblings, so the documented
 * `continueOnItemError` default (stop at the first failing item) holds here too.
 */
export const handleRecordBatchCreate: ActionHandler = (action, app, automation, runContext) =>
  Effect.gen(function* () {
    const props = resolvedProps(action, runContext)
    const tableName = stringProp(props, 'table')
    if (!tableName) {
      return { status: 'failure', error: 'record.batchCreate requires a table name' } as const
    }
    const continueOnItemError = props['continueOnItemError'] === true

    // Same rationale as handleRecordCreate: a durable, non-null actor id — the
    // caller of a hand-started run, else the system — satisfies NOT-NULL
    // authorship columns.
    const actorId = writerActorOf(automation)
    const session = buildSyntheticSession(actorId)
    const authorship = buildCreateAuthorshipOverrides(app.tables, tableName, actorId)
    const tally = yield* runBatchItems({
      items: itemsOf(props),
      continueOnItemError,
      runItem: (item) =>
        createItem({ item, tableName, session, authorship, app, automation, runContext }),
    })
    return batchOutcome({
      tally,
      output: { created: tally.created, failed: tally.failed },
      continueOnItemError,
      fallbackError: 'batch create failed',
    })
  }).pipe(
    Effect.withSpan('automations.handle-record-batch-create', {
      attributes: actionAttributes(action),
    })
  )

// ---------------------------------------------------------------------------
// record/batchUpdate
// ---------------------------------------------------------------------------

/**
 * An item-level rendering of {@link resolveActionTargetIds}'s refusal.
 *
 * The batch operators report per-ITEM results, not action outcomes, so the
 * refusal is re-dressed as an `ItemResult` rather than re-derived — using the
 * shared resolver keeps `batchUpdate`/`batchUpsert` on exactly the filter
 * semantics `record/update` and `record/delete` have, which is the whole point
 * of there being one resolver.
 */
const refusedItem = (outcome: ActionOutcome): ItemResult =>
  failed(outcome.error ?? 'record filter could not be resolved')

/**
 * Write one change to every matched row — the update half `batchUpdate` and
 * `batchUpsert` share. It goes through the records API's update program WITH
 * the app, so a many-to-many field is written to its junction rather than
 * failing on a base column it does not have, and a cleared one unlinks only
 * what the run's starter may read (every link for a run nobody started) —
 * exactly as `record/update` does.
 */
const writeUpdates = (input: {
  readonly actorId: string
  readonly tableName: string
  readonly ids: readonly string[]
  readonly data: Readonly<Record<string, unknown>>
  readonly app: App
  readonly automation: AutomationContext
  readonly runContext: ActionRunContext | undefined
}): Effect.Effect<ItemResult, never, GateRequirements> =>
  Effect.gen(function* () {
    const { actorId, tableName, ids, data, app, automation, runContext } = input
    const loop = recordEventLoopRefusal(runContext, tableName, 'update', Object.keys(data))
    if (loop !== undefined) return failed(loop.error ?? 'record-event loop')
    const session = buildSyntheticSession(actorId)
    const linkReader = yield* runLinkReader(automation)
    const fields = { ...data, ...buildUpdateAuthorshipOverrides(app.tables, tableName, actorId) }
    const written = yield* Effect.result(
      Effect.forEach(
        ids,
        (recordId) =>
          updateAndAnnounce({
            ...{ session, tableName, recordId, fields, app, runContext },
            ...(linkReader === undefined ? {} : { linkReader }),
          }),
        { discard: true }
      )
    )
    return written._tag === 'Failure'
      ? failed(errorMessageOf(written.failure))
      : ({ kind: 'updated' } as const)
  }).pipe(Effect.withSpan('automations.batch-write-updates'))

const applyUpdateItem = (input: {
  readonly item: unknown
  readonly tableName: string
  readonly app: App
  readonly automation: AutomationContext
  readonly runContext: ActionRunContext | undefined
}): Effect.Effect<ItemResult, never, GateRequirements> =>
  Effect.gen(function* () {
    const { item, tableName, app, automation, runContext } = input
    const entry = asRecord(item)
    if (entry === undefined) return failed('batchUpdate item must be an object')

    const data = asRecord(entry['data']) ?? asRecord(entry['fields'])
    if (data === undefined) return failed('batchUpdate item requires a `data` object')

    // Multi-select membership + cardinality — see `createItem`. Runs before the
    // target lookup so a bad payload is rejected without spending a query.
    const multiSelectError = findMultiSelectViolationMessage(app, tableName, data)
    if (multiSelectError) return failed(multiSelectError)

    // This is the operator the RUNTIME field check exists for: `items` is
    // designed to arrive as `{{trigger.data.items}}`, and `resolveTriggerInValue`
    // rewrites every string leaf of it — so an item's `filter.field` can come
    // straight from a webhook payload and does not exist at config time at all.
    // An unresolvable field is reported as itself rather than as "matched no
    // records": the two are indistinguishable from run history, and on SQLite
    // the unrefused form of that filter matches EVERY row.
    const targets = yield* resolveActionTargetIds({
      operator: 'batchUpdate item',
      tableName,
      filter: entry['filter'],
      declaredFields: declaredFieldNames(app, tableName),
    })
    if (!targets.resolved) return refusedItem(targets.outcome)

    const { ids } = targets
    if (ids.length === 0) {
      // An item whose filter matches nothing is a FAILURE, not a silent no-op:
      // it is indistinguishable from a typo'd filter, and swallowing it lets a
      // broken integration report a clean run forever.
      return failed(`batchUpdate item matched no records in '${tableName}'`)
    }
    const requests = updatesOf(tableName, ids, data)
    if (!(yield* callerMayWrite(app, automation, requests))) return failed(CALLER_REFUSAL)
    const actorId = writerActorOf(automation)
    const admitted = yield* admitAttachments({
      ...{ app, actorId, tableName, values: data, requests, written: automation.writtenFiles },
    })
    if (admitted.status === 'failure') return failed(admitted.error)
    const { values } = admitted
    return yield* writeUpdates({
      actorId,
      tableName,
      ids,
      data: values,
      app,
      automation,
      runContext,
    })
  })

export const handleRecordBatchUpdate: ActionHandler = (action, app, automation, runContext) =>
  Effect.gen(function* () {
    const props = resolvedProps(action, runContext)
    const tableName = stringProp(props, 'table')
    if (!tableName) {
      return { status: 'failure', error: 'record.batchUpdate requires a table name' } as const
    }
    const continueOnItemError = props['continueOnItemError'] === true
    const tally = yield* runBatchItems({
      items: itemsOf(props),
      continueOnItemError,
      runItem: (item) => applyUpdateItem({ item, tableName, app, automation, runContext }),
    })
    return batchOutcome({
      tally,
      output: { updated: tally.updated, failed: tally.failed },
      continueOnItemError,
      fallbackError: 'record.batchUpdate failed',
    })
  }).pipe(
    Effect.withSpan('automations.handle-record-batch-update', {
      attributes: actionAttributes(action),
    })
  )

// ---------------------------------------------------------------------------
// record/batchUpsert
// ---------------------------------------------------------------------------

const upsertItem = (input: {
  readonly item: unknown
  readonly tableName: string
  readonly matchField: string
  readonly app: App
  readonly automation: AutomationContext
  readonly runContext: ActionRunContext | undefined
}): Effect.Effect<ItemResult, never, GateRequirements> =>
  Effect.gen(function* () {
    const { item, tableName, matchField, app, automation, runContext } = input
    const data = asRecord(item)
    if (data === undefined) return failed('batchUpsert item must be an object')

    // Multi-select membership + cardinality — see `createItem`. Checked once
    // here rather than inside `createUpsertRow`/`updateUpsertRows`: `data` is
    // the same payload on both branches.
    const multiSelectError = findMultiSelectViolationMessage(app, tableName, data)
    if (multiSelectError) return failed(multiSelectError)

    const matchValue = data[matchField]
    if (matchValue === undefined || matchValue === null || matchValue === '') {
      // Without the declared match field the item can be neither matched nor
      // meaningfully created — creating it would produce an unreachable row a
      // later sync could never update, silently duplicating on every replay.
      return failed(`batchUpsert item is missing its match field '${matchField}'`)
    }

    // Lenient — pre-existing, and the sharpest of the lenient sites: a failed
    // lookup reads as "no existing row", so this takes the CREATE branch below
    // and every retry duplicates. See `resolveIdsByFilterLenient`. A
    // `matchField` naming no column is refused rather than degraded into that
    // branch: `matchField` may itself arrive templated, and on SQLite the
    // unrefused lookup matches every row and the upsert UPDATES THE TABLE.
    const targets = yield* resolveActionTargetIds({
      operator: 'batchUpsert item',
      tableName,
      filter: { conditions: [{ field: matchField, operator: 'equals', value: matchValue }] },
      declaredFields: declaredFieldNames(app, tableName),
    })
    if (!targets.resolved) return refusedItem(targets.outcome)

    const { ids } = targets
    const writes: readonly CallerWriteRequest[] =
      ids.length === 0
        ? [{ op: 'create', tableName, fields: data }]
        : updatesOf(tableName, ids, data)
    const admitted = yield* itemAdmission({
      ...{ app, automation, tableName, values: data, requests: writes },
    })
    if (admitted.status === 'failure') return failed(admitted.error)
    const actorId = writerActorOf(automation)
    const session = buildSyntheticSession(actorId)
    const { values } = admitted
    return ids.length === 0
      ? yield* createUpsertRow({ session, actorId, tableName, data: values, app, runContext })
      : yield* writeUpdates({ actorId, tableName, ids, data: values, app, automation, runContext })
  })

const createUpsertRow = (input: {
  readonly session: ReturnType<typeof buildSyntheticSession>
  readonly actorId: string
  readonly tableName: string
  readonly data: Record<string, unknown>
  readonly app: App
  readonly runContext: ActionRunContext | undefined
}): Effect.Effect<ItemResult, never, GateRequirements> =>
  Effect.gen(function* () {
    const { session, actorId, tableName, data, app, runContext } = input
    const loop = recordEventLoopRefusal(runContext, tableName, 'create')
    if (loop !== undefined) return failed(loop.error ?? 'record-event loop')
    const created = yield* Effect.result(
      createAndAnnounce({
        session,
        app,
        tableName,
        fields: automationCreateFields(app, tableName, data, actorId),
        runContext,
      })
    )
    return created._tag === 'Failure'
      ? failed(errorMessageOf(created.failure))
      : ({ kind: 'created' } as const)
  })

export const handleRecordBatchUpsert: ActionHandler = (action, app, automation, runContext) =>
  Effect.gen(function* () {
    const props = resolvedProps(action, runContext)
    const tableName = stringProp(props, 'table')
    if (!tableName) {
      return { status: 'failure', error: 'record.batchUpsert requires a table name' } as const
    }
    const matchField = stringProp(props, 'matchField')
    if (!matchField) {
      return { status: 'failure', error: 'record.batchUpsert requires a matchField' } as const
    }
    const continueOnItemError = props['continueOnItemError'] === true
    const tally = yield* runBatchItems({
      items: itemsOf(props),
      continueOnItemError,
      runItem: (item) => upsertItem({ item, tableName, matchField, app, automation, runContext }),
    })
    return batchOutcome({
      tally,
      output: { created: tally.created, updated: tally.updated, failed: tally.failed },
      continueOnItemError,
      fallbackError: 'record.batchUpsert failed',
    })
  }).pipe(
    Effect.withSpan('automations.handle-record-batch-upsert', {
      attributes: actionAttributes(action),
    })
  )
