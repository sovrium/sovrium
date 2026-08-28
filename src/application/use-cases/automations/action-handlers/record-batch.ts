/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  createRecordProgram,
  deleteRecordProgram,
  updateRecordProgram,
} from '@/application/use-cases/tables/programs'
import {
  buildCreateAuthorshipOverrides,
  buildUpdateAuthorshipOverrides,
} from '@/domain/services/authorship-fields'
import { SYSTEM_USER_ID } from '@/domain/services/guest-session'
import { buildSystemSession } from '../build-guest-session'
import { failed, batchOutcome, runBatchItems } from './record-batch-loop'
import {
  declaredFieldNames,
  errorMessageOf,
  extractIdFromFilter,
  resolveActionTargetIds,
  resolveIdsByFilter,
} from './record-filters'
import {
  buildRunContextView,
  rawActionProps,
  resolveRunContextValue,
} from './run-context-resolution'
import { findMultiSelectViolationMessage, numberProp, stringProp } from './shared'
import type { ItemResult } from './record-batch-loop'
import type { ActionHandler, ActionOutcome } from './shared'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import type { DatabaseError, UnknownFilterFieldError } from '@/domain/errors'
import type { App } from '@/domain/models/app'

/**
 * The `record` batch operators: `batchCreate`, `batchUpdate`, `batchDelete` and
 * `batchUpsert`.
 *
 * All but `batchCreate` were declarable in AppSchema — documented, validated,
 * accepted by `sovrium validate` — with no registered handler, so every run
 * dispatched them to the registry's no-op fallback, recorded the step as
 * successful, and wrote nothing.
 *
 * ── Why these loop the single-record programs ────────────────────────────────
 *
 * `batchUpdateProgram` / `batchDeleteProgram` in
 * `@/application/use-cases/tables/batch-operations` look like the obvious reuse,
 * but they require `BatchRepository`, which is absent from `ActionHandler`'s
 * requirement union (`./shared`). Adopting them means threading a new layer
 * through the whole automation runtime for no behavioural gain. So these follow
 * the precedent set by the original `batchCreate` handler: loop the
 * single-record program, which keeps every write on the same permission / audit
 * / cascade pipeline a single-record action uses.
 *
 * ── continueOnItemError: ONE rule, one implementation ────────────────────────
 *
 * All three item-array operators declare the flag with byte-identical wording —
 * "Continue processing remaining items if one fails (default: false)" — so the
 * default STOPS at the first failing item rather than attempting the rest and
 * reporting afterwards. That matters for a batch of writes: a run that is going
 * to abort anyway should not keep committing rows past the failure.
 *
 * `batchCreate` originally attempted every item regardless and only used the
 * flag to decide the STEP's final status, contradicting its own published
 * annotation. It was moved here and onto the shared `runBatchItems` loop rather
 * than left to diverge: three copies of one rule is how the divergence arose in
 * the first place. `continueOnItemError: true` is unaffected — it still attempts
 * every item — so the change is confined to the documented default.
 *
 * Specs: [internal ref]..003,
 * -BATCHUPDATE-001..003, -BATCHDELETE-001..003, -BATCHUPSERT-001..003
 * (+ REGRESSION).
 */

/** A batch operator's resolved `props` bag — read-only at every use site here. */
type BatchProps = Readonly<Record<string, unknown>>

/**
 * Re-resolve the action's props from the RAW pre-substitution action.
 *
 * The run loop's `resolveTriggerInValue` pass rewrites every STRING leaf through
 * the template engine, so `items: '{{trigger.data.items}}'` — a string leaf
 * pointing at an ARRAY — reaches the handler as rendered text and iterates as
 * zero items. `resolveRunContextValue` instead unwraps a whole-string `{{path}}`
 * to the VALUE at that path, arrays intact. Shared by all four operators.
 */
const resolvedProps = (action: BatchProps, runContext: Parameters<ActionHandler>[3]): BatchProps =>
  runContext
    ? (resolveRunContextValue(
        rawActionProps(runContext),
        buildRunContextView(runContext)
      ) as Record<string, unknown>)
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

const asRecord = (value: unknown): BatchProps | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined

// ---------------------------------------------------------------------------
// record/batchCreate
// ---------------------------------------------------------------------------

const createItem = (input: {
  readonly item: unknown
  readonly tableName: string
  readonly session: ReturnType<typeof buildSystemSession>
  readonly authorship: Readonly<Record<string, string>>
  readonly app: App
}): Effect.Effect<ItemResult, never, TableRepository> =>
  Effect.gen(function* () {
    const { item, tableName, session, authorship, app } = input
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

    const created = yield* Effect.result(
      createRecordProgram({ session, tableName, fields: { ...fields, ...authorship } })
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
export const handleRecordBatchCreate: ActionHandler = (action, app, _automation, runContext) =>
  Effect.gen(function* () {
    const props = resolvedProps(action, runContext)
    const tableName = stringProp(props, 'table')
    if (!tableName) {
      return { status: 'failure', error: 'record.batchCreate requires a table name' } as const
    }
    const continueOnItemError = props['continueOnItemError'] === true

    // System authority — same rationale as handleRecordCreate: a durable,
    // non-null actor id satisfies NOT-NULL authorship columns.
    const session = buildSystemSession()
    const authorship = buildCreateAuthorshipOverrides(app.tables, tableName, SYSTEM_USER_ID)
    const tally = yield* runBatchItems({
      items: itemsOf(props),
      continueOnItemError,
      runItem: (item) => createItem({ item, tableName, session, authorship, app }),
    })
    return batchOutcome({
      tally,
      output: { created: tally.created, failed: tally.failed },
      continueOnItemError,
      fallbackError: 'batch create failed',
    })
  })

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

const applyUpdateItem = (input: {
  readonly item: unknown
  readonly tableName: string
  readonly app: App
}): Effect.Effect<ItemResult, never, TableRepository> =>
  Effect.gen(function* () {
    const { item, tableName, app } = input
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

    const session = buildSystemSession()
    const fields = {
      ...data,
      ...buildUpdateAuthorshipOverrides(app.tables, tableName, SYSTEM_USER_ID),
    }
    const written = yield* Effect.result(
      Effect.forEach(ids, (id) => updateRecordProgram(session, tableName, id, { fields }), {
        discard: true,
      })
    )
    return written._tag === 'Failure'
      ? failed(errorMessageOf(written.failure))
      : ({ kind: 'updated' } as const)
  })

export const handleRecordBatchUpdate: ActionHandler = (action, app, _automation, runContext) =>
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
      runItem: (item) => applyUpdateItem({ item, tableName, app }),
    })
    return batchOutcome({
      tally,
      output: { updated: tally.updated, failed: tally.failed },
      continueOnItemError,
      fallbackError: 'record.batchUpdate failed',
    })
  })

// ---------------------------------------------------------------------------
// record/batchUpsert
// ---------------------------------------------------------------------------

const upsertItem = (input: {
  readonly item: unknown
  readonly tableName: string
  readonly matchField: string
  readonly app: App
}): Effect.Effect<ItemResult, never, TableRepository> =>
  Effect.gen(function* () {
    const { item, tableName, matchField, app } = input
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
    const session = buildSystemSession()
    return ids.length === 0
      ? yield* createUpsertRow({ session, tableName, data, app })
      : yield* updateUpsertRows({ session, tableName, ids, data, app })
  })

const createUpsertRow = (input: {
  readonly session: ReturnType<typeof buildSystemSession>
  readonly tableName: string
  readonly data: Record<string, unknown>
  readonly app: App
}): Effect.Effect<ItemResult, never, TableRepository> =>
  Effect.gen(function* () {
    const { session, tableName, data, app } = input
    const created = yield* Effect.result(
      createRecordProgram({
        session,
        tableName,
        fields: {
          ...data,
          ...buildCreateAuthorshipOverrides(app.tables, tableName, SYSTEM_USER_ID),
        },
      })
    )
    return created._tag === 'Failure'
      ? failed(errorMessageOf(created.failure))
      : ({ kind: 'created' } as const)
  })

const updateUpsertRows = (input: {
  readonly session: ReturnType<typeof buildSystemSession>
  readonly tableName: string
  readonly ids: readonly string[]
  readonly data: Record<string, unknown>
  readonly app: App
}): Effect.Effect<ItemResult, never, TableRepository> =>
  Effect.gen(function* () {
    const { session, tableName, ids, data, app } = input
    const fields = {
      ...data,
      ...buildUpdateAuthorshipOverrides(app.tables, tableName, SYSTEM_USER_ID),
    }
    const written = yield* Effect.result(
      Effect.forEach(ids, (id) => updateRecordProgram(session, tableName, id, { fields }), {
        discard: true,
      })
    )
    return written._tag === 'Failure'
      ? failed(errorMessageOf(written.failure))
      : ({ kind: 'updated' } as const)
  })

export const handleRecordBatchUpsert: ActionHandler = (action, app, _automation, runContext) =>
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
      runItem: (item) => upsertItem({ item, tableName, matchField, app }),
    })
    return batchOutcome({
      tally,
      output: { created: tally.created, updated: tally.updated, failed: tally.failed },
      continueOnItemError,
      fallbackError: 'record.batchUpsert failed',
    })
  })

// ---------------------------------------------------------------------------
// record/batchDelete
// ---------------------------------------------------------------------------

/**
 * Resolve the rows `batchDelete` targets — STRICTLY.
 *
 * Unlike {@link resolveItemIds} this propagates a lookup failure instead of
 * reading it as an empty match set. A delete driven by a query it could not
 * run knows nothing about what it was supposed to remove, and reporting that
 * as `matched: 0` and succeeding is how a broken nightly purge stays invisible
 * for months.
 */
const resolveTargetIds = (
  tableName: string,
  filter: unknown,
  declaredFields: ReadonlySet<string> | undefined
): Effect.Effect<readonly string[], DatabaseError | UnknownFilterFieldError, TableRepository> => {
  const fastPath = extractIdFromFilter(filter)
  return fastPath
    ? Effect.succeed([fastPath] as const)
    : resolveIdsByFilter(tableName, filter, declaredFields)
}

/**
 * An error's message plus the driver's own words underneath it.
 *
 * `DatabaseError`'s message is a wrapper — "Failed to list records from events"
 * — which tells an operator only that something failed. The `cause` carries the
 * fact they can act on (`column "knid" does not exist`). Failing loudly but
 * anonymously is only half the fix, so the lookup failure carries both. It goes
 * through the same run-history redaction seam as every other action error.
 */
const withDriverDetail = (error: unknown): string => {
  const head = errorMessageOf(error)
  const cause = error instanceof Error ? error.cause : undefined
  const detail = cause === undefined || cause === null ? '' : errorMessageOf(cause)
  return detail === '' || head.includes(detail) ? head : `${head}: ${detail}`
}

/**
 * The cap applied when the config declares no `limit`.
 *
 * `limit` is optional, so an omitted one used to mean NO cap — strictly more
 * permissive than the largest cap an author is allowed to write, since the
 * schema bounds the declared value to `1..10_000`. Omitting the safety limit
 * therefore bought more reach than asking for the maximum, which is the
 * opposite of what a safety limit is for. Defaulting to the schema's own
 * ceiling closes that hole without inventing a number: every batch an author
 * could have expressed explicitly still runs unchanged.
 */
const DEFAULT_BATCH_DELETE_LIMIT = 10_000

const declaresLimit = (props: BatchProps): boolean => props['limit'] !== undefined

const effectiveLimit = (props: BatchProps): number =>
  declaresLimit(props)
    ? numberProp(props, 'limit', DEFAULT_BATCH_DELETE_LIMIT)
    : DEFAULT_BATCH_DELETE_LIMIT

/** Names both numbers so the fix — narrow the filter, or raise the cap — is obvious. */
const limitExceededError = (input: {
  readonly matched: number
  readonly limit: number
  readonly declared: boolean
}): string =>
  `record.batchDelete matched ${String(input.matched)} records, which exceeds its ` +
  `${input.declared ? 'safety limit' : 'default safety limit'} of ${String(input.limit)}; ` +
  `nothing was deleted`

/** How far a delete loop got before it stopped. */
interface DeleteTally {
  readonly deleted: number
  readonly error: string | undefined
}

/**
 * Delete each matched row, counting the ones that actually landed and halting
 * at the first failure.
 *
 * The loop is NOT atomic — each `deleteRecordProgram` commits its own
 * transaction — so a failure part-way through leaves the earlier deletes
 * committed. Reporting `deleted: 0` there (as this handler did) tells the
 * operator nothing was removed while rows are already gone, which is the same
 * class of lie the over-limit refusal exists to prevent. Counting instead is
 * the weaker but honest guarantee: `deleted` is what committed, always.
 *
 * Atomicity is reachable — `BatchRepository.batchDelete` wraps the whole set in
 * one `db.transaction` — but that port is absent from `ActionHandler`'s
 * requirement union, so adopting it means threading a new layer through the
 * entire automation runtime. Same reason the module doc gives for looping the
 * single-record programs in the first place.
 *
 * A row whose delete reports `success: false` (it vanished between the query
 * and the write) is not counted and does not abort the loop, so `deleted` can
 * legitimately come in under `matched` on an otherwise successful run.
 */
const deleteMatchedRows = (input: {
  readonly tableName: string
  readonly ids: readonly string[]
}): Effect.Effect<DeleteTally, never, TableRepository> => {
  // System authority — soft-delete stamps `deleted_by` with the durable
  // system actor instead of NULL under the guest id.
  const session = buildSystemSession()
  const start = (): DeleteTally => ({ deleted: 0, error: undefined })
  return Effect.reduce(input.ids, start, (tally, id) =>
    tally.error !== undefined
      ? Effect.succeed(tally)
      : Effect.result(deleteRecordProgram(session, input.tableName, id)).pipe(
          Effect.map((result) =>
            result._tag === 'Failure'
              ? { ...tally, error: withDriverDetail(result.failure) }
              : { ...tally, deleted: tally.deleted + (result.success.success ? 1 : 0) }
          )
        )
  )
}

/**
 * `record/batchDelete` — query-then-delete. Unlike its batch siblings it takes
 * no `items` array: its props are `{ table, filter, limit }`.
 *
 * `limit` is documented in the schema as a SAFETY limit, so exceeding it
 * refuses the WHOLE operation rather than deleting the first `limit` matches.
 * A partial purge is the failure mode the cap exists to prevent: the operator
 * would see rows gone, rows remaining, and a successful run, and conclude their
 * filter was wrong rather than that the cap fired. The error therefore names
 * both numbers — how many matched and what the cap was — so the fix (raise the
 * cap, or narrow the filter) is obvious without a database query. An omitted
 * `limit` gets the schema's own ceiling rather than no cap at all; see
 * {@link DEFAULT_BATCH_DELETE_LIMIT}.
 *
 * Every path that ends in `failure` reports what it actually removed:
 * {@link resolveTargetIds} refuses on a failed lookup rather than passing it
 * off as an empty match set, and {@link deleteMatchedRows} carries the
 * committed count out of a part-way failure.
 */
export const handleRecordBatchDelete: ActionHandler = (action, app, _automation, runContext) =>
  Effect.gen(function* () {
    const props = resolvedProps(action, runContext)
    const tableName = stringProp(props, 'table')
    if (!tableName) {
      return { status: 'failure', error: 'record.batchDelete requires a table name' } as const
    }

    const { filter } = props
    const lookup = yield* Effect.result(
      resolveTargetIds(tableName, filter, declaredFieldNames(app, tableName))
    )
    if (lookup._tag === 'Failure') {
      return {
        status: 'failure',
        error: `record.batchDelete could not resolve its filter: ${withDriverDetail(lookup.failure)}`,
      } as const
    }

    const ids = lookup.success
    if (ids.length === 0) {
      // Distinguish "matched nothing" (a normal outcome — nothing to clean up)
      // from "the filter was unusable". An empty or malformed filter must never
      // degrade to match-everything on a delete.
      return unusableFilter(filter)
        ? ({
            status: 'failure',
            error: 'record.batchDelete requires a filter with at least one condition',
          } as const)
        : ({ status: 'success', output: { matched: 0, deleted: 0 } } as const)
    }

    const limit = effectiveLimit(props)
    if (ids.length > limit) {
      return {
        status: 'failure',
        error: limitExceededError({
          matched: ids.length,
          limit,
          declared: declaresLimit(props),
        }),
        output: { matched: ids.length, deleted: 0 },
      } as const
    }

    const tally = yield* deleteMatchedRows({ tableName, ids })
    const output = { matched: ids.length, deleted: tally.deleted }
    return tally.error === undefined
      ? ({ status: 'success', output } as const)
      : ({ status: 'failure', error: tally.error, output } as const)
  })

/** True when a filter carries no condition the repository could compile. */
const unusableFilter = (filter: unknown): boolean =>
  extractIdFromFilter(filter) === undefined && !hasCompilableConditions(filter)

const hasCompilableConditions = (filter: unknown): boolean => {
  if (!filter || typeof filter !== 'object') return false
  const { conditions } = filter as { readonly conditions?: unknown }
  if (!Array.isArray(conditions)) return false
  return conditions.some((c) => {
    const entry = asRecord(c)
    return typeof entry?.['field'] === 'string' && typeof entry['operator'] === 'string'
  })
}
