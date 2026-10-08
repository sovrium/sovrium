/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `record/batchDelete` — split from `record-batch.ts` so each module stays
 * inside its size limit. Each matched row is moved to the trash through the
 * records API's delete road, as `record/delete` does: see that module's header.
 */

import { Effect } from 'effect'
import { buildSyntheticSession } from '../build-guest-session'
import { asRecord, resolvedProps, type BatchProps, type GateRequirements } from './record-batch'
import { CALLER_REFUSAL, callerMayWrite, deletesOf, writerActorOf } from './record-caller-gate'
import { deleteAndAnnounce, recordEventLoopRefusal } from './record-events'
import {
  declaredFieldNames,
  errorMessageOf,
  extractIdFromFilter,
  resolveIdsByFilter,
} from './record-filters'
import { actionAttributes, numberProp, stringProp } from './shared'
import type { ActionHandler, ActionRunContext } from './shared'
import type { DatabaseError, UnknownFilterFieldError } from '@/domain/errors'
import type { App } from '@/domain/models/app'

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
): Effect.Effect<readonly string[], DatabaseError | UnknownFilterFieldError, GateRequirements> => {
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
 * `limit` is optional, and an omitted one meaning NO cap would be strictly more
 * permissive than the largest cap an author is allowed to write, since the
 * schema bounds the declared value to `1..10_000`. Omitting the safety limit
 * would then buy more reach than asking for the maximum, which is the
 * opposite of what a safety limit is for. Defaulting to the schema's own
 * ceiling closes that hole without inventing a number: every batch an author
 * could express explicitly runs unchanged.
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
 * The loop is NOT atomic — each delete through the delete road commits its own
 * transaction — so a failure part-way through leaves the earlier deletes
 * committed. Reporting `deleted: 0` there (as this handler did) tells the
 * operator that no row went while rows are already gone, which is the same
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
  readonly app: App
  readonly tableName: string
  readonly ids: readonly string[]
  readonly actorId: string
  readonly runContext: ActionRunContext | undefined
}): Effect.Effect<DeleteTally, never, GateRequirements> => {
  // Soft-delete stamps `deleted_by` with the caller of a hand-started run, else
  // the durable system actor — never NULL under the guest id.
  const session = buildSyntheticSession(input.actorId)
  const { app, tableName, runContext } = input
  // Past the record-event depth limit, the step deletes nothing and says why.
  const loop = recordEventLoopRefusal(runContext, tableName, 'delete')
  const start = (): DeleteTally => ({ deleted: 0, error: loop?.error })
  return Effect.reduce(input.ids, start, (tally, recordId) =>
    tally.error !== undefined
      ? Effect.succeed(tally)
      : Effect.result(deleteAndAnnounce({ session, app, tableName, recordId, runContext })).pipe(
          Effect.map((result) =>
            result._tag === 'Failure'
              ? { ...tally, error: withDriverDetail(result.failure) }
              : { ...tally, deleted: tally.deleted + (result.success.success ? 1 : 0) }
          )
        )
  )
}

/** A batch delete the caller may not make: refused whole, nothing removed. */
const REFUSED_DELETE = {
  status: 'failure',
  error: CALLER_REFUSAL,
  output: { matched: 0, deleted: 0 },
} as const

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
export const handleRecordBatchDelete: ActionHandler = (action, app, automation, runContext) =>
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

    if (!(yield* callerMayWrite(app, automation, deletesOf(tableName, ids)))) return REFUSED_DELETE
    const actorId = writerActorOf(automation)
    const tally = yield* deleteMatchedRows({ app, tableName, ids, runContext, actorId })
    const output = { matched: ids.length, deleted: tally.deleted }
    return tally.error === undefined
      ? ({ status: 'success', output } as const)
      : ({ status: 'failure', error: tally.error, output } as const)
  }).pipe(
    Effect.withSpan('automations.handle-record-batch-delete', {
      attributes: actionAttributes(action),
    })
  )

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
