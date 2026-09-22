/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AI-compute write-phase signalling ([internal ref] Phase 2, design §4).
 *
 * Runs at the create/update write seam for BOTH dialects. For each AI-compute
 * field that fired on the write it consults the shared baseline guard:
 *
 *   - USER OVERRIDE (`preserve`): the user supplied an explicit value, so the
 *     baseline was NOT recomputed and the field must NOT be refined. We write a
 *     `skipped` status row directly (no provider call, no clobber). This is the
 *     ONLY signal source for the override case — the Postgres trigger
 *     short-circuits before `pg_notify`, so no NOTIFY ever fires for it.
 *
 *   - COMPUTE: the deterministic baseline was written and a refinement should
 *     follow. On SQLite (no NOTIFY listener) the shared worker is enqueued here;
 *     on Postgres the NOTIFY listener invokes the same worker, so this path is a
 *     no-op (the `skipped`-on-override write still runs on both dialects).
 *
 * Both runners are fire-and-forget — they never block the HTTP response (the
 * baseline already shipped). Gated: tables with no AI-compute fields do nothing.
 */

import { Cause, Effect } from 'effect'
import {
  applyBaselineGuard,
  isExplicitUserValue,
  type AiComputeKind,
} from '@/domain/models/app/tables/ai-compute-baseline'
import { fieldToRequestConfig } from '@/domain/models/app/tables/ai-compute-build-request'
import { upsertAiComputeStatus } from '@/infrastructure/database/ai-compute-status-repository'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { logError } from '@/infrastructure/logging/logger'
import {
  AiComputeStoreError,
  refineAiComputeField,
  type RefineAiComputeFieldInput,
} from './refine-field'
import type { AiService } from '@/application/ports/services/ai-service'
import type { App, Table } from '@/domain/models/app'
import type { Fields } from '@/domain/models/app/tables/fields'

const AI_COMPUTE_KINDS: ReadonlySet<string> = new Set<AiComputeKind>([
  'ai-summary',
  'ai-categorize',
  'ai-tag',
  'ai-translate',
  'ai-extract',
  'ai-sentiment',
  'ai-generate',
])

type AiComputeField = Extract<Fields[number], { readonly type: AiComputeKind }>

const isAiComputeField = (field: Fields[number]): field is AiComputeField =>
  AI_COMPUTE_KINDS.has(field.type)

/** Whether an AI-compute field fires for the given write operation. */
const firesFor = (field: { readonly computeOn?: string }, op: 'insert' | 'update'): boolean => {
  const computeOn = field.computeOn ?? 'create'
  if (computeOn === 'manual') return false
  if (op === 'insert') return computeOn === 'create' || computeOn === 'both'
  return computeOn === 'update' || computeOn === 'both'
}

/** Concatenate the field's `sourceFields` (COALESCE-style, space-joined). */
const buildSource = (
  sourceFields: readonly string[],
  fields: Readonly<Record<string, unknown>>
): string =>
  sourceFields
    .map((sf) => {
      const value = fields[sf]
      return value === null || value === undefined ? '' : String(value)
    })
    .join(' ')

/** Whether any configured source field changed between `old` and `incoming`. */
const sourceChanged = (
  sourceFields: readonly string[],
  incoming: Readonly<Record<string, unknown>>,
  old: Readonly<Record<string, unknown>> | undefined
): boolean => sourceFields.some((sf) => sf in incoming && incoming[sf] !== old?.[sf])

/** A firing AI-compute field paired with the baseline-guard decision. */
interface FieldDecision {
  readonly field: AiComputeField
  readonly preserved: boolean
}

/**
 * The AI-compute columns the user WROTE BY HAND in this write.
 *
 * Deliberately independent of `computeOn`. `computeOn` answers "should the
 * platform compute this field on this operation" — a question about the WORKER.
 * Whether the value now in the column came from a person is a question about the
 * VALUE, and the two are not the same question. Conflating them is what left a
 * `failed` status sitting beside a user's own sentence: `computeOn` defaults to
 * `create`, so on an update the field was filtered out before any guard ran, and
 * the status row was never touched. Four of the seven AI types never declare
 * `computeOn` at all, so that was the common path, not an edge.
 *
 * `isExplicitUserValue` is the guard's own predicate rather than a re-statement,
 * so "the user really supplied this" cannot come to mean two different things.
 */
const userAuthoredAiFields = (
  table: Table,
  incoming: Readonly<Record<string, unknown>>
): readonly AiComputeField[] =>
  (table.fields ?? [])
    .filter(isAiComputeField)
    .filter((f) => f.name in incoming && isExplicitUserValue(f.type, incoming[f.name]))

/** Record `skipped` for a set of fields on one record (idempotent upserts). */
const writeSkippedStatuses = (params: {
  readonly appId: string
  readonly tableName: string
  readonly recordId: string | number
  readonly fields: readonly AiComputeField[]
}): Effect.Effect<void, AiComputeStoreError> => {
  const { appId, tableName, recordId, fields } = params
  return Effect.forEach(
    fields,
    (field) =>
      Effect.tryPromise({
        try: () =>
          upsertAiComputeStatus(
            { appId, tableName, recordId: String(recordId), fieldName: field.name },
            'skipped'
          ),
        catch: (cause) => new AiComputeStoreError({ step: 'write-status', cause }),
      }),
    { discard: true }
  )
}

/** One record's user-supplied field map, as the batch write paths carry it. */
export interface AiComputeBatchWrite {
  readonly id: string | number
  readonly fields: Readonly<Record<string, unknown>>
}

/**
 * Re-key every hand-written AI-compute column across a BATCH of records to
 * `skipped`, in one detached program rather than one per record.
 *
 * `skipped` rather than deleting the row: it already means "a user edit is in
 * the column and the worker declined to clobber it", which is exactly true of a
 * value the worker will now never touch. Deleting would also stop the false
 * claim, but it would erase the difference between "the user wrote this" and
 * "this field never had a status at all" — and since the read projection omits
 * the block entirely when no rows exist, a deleted row is indistinguishable
 * from a non-AI column. Re-keying keeps the four-state vocabulary closed and
 * lets the upsert clear the recorded provider error in the same write.
 *
 * The batch update paths never signalled the write phase at all, so a hand edit
 * arriving through `PATCH /records/batch` or a bulk update left a `failed`
 * status describing the user's own text — the identical defect the
 * single-record path had, reachable by a different endpoint. A fix that depends
 * on which endpoint the client happened to call is not a fix.
 *
 * The single-record paths get the same treatment inside
 * {@link signalAiComputeWritePhase}, which already receives the user's field
 * map; both routes share `userAuthoredAiFields`, so what counts as
 * "hand-written" cannot come to mean two different things.
 */
export const markUserAuthoredAiFieldsForRecords = (params: {
  readonly app: App
  readonly tableName: string
  readonly records: readonly AiComputeBatchWrite[]
}): Effect.Effect<void> => {
  const { app, tableName, records } = params
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table) return Effect.void
  const work = records.flatMap((record) => {
    const authored = userAuthoredAiFields(table, record.fields)
    return authored.length === 0 ? [] : [{ recordId: record.id, fields: authored }]
  })
  if (work.length === 0) return Effect.void
  return labelled(
    Effect.forEach(
      work,
      (item) =>
        writeSkippedStatuses({
          appId: app.name,
          tableName,
          recordId: item.recordId,
          fields: item.fields,
        }),
      { discard: true }
    ),
    'user-authored-skipped-batch'
  ).pipe(Effect.withSpan('ai-compute.mark-user-authored-ai-fields-for-records'))
}

/**
 * Resolve, for every firing AI-compute field, whether the user's incoming write
 * preserved an explicit value (override → `skipped`) or the baseline was
 * (re)computed (→ refine). Returns `[]` for non-AI tables (gated).
 */
const resolveFieldDecisions = (params: {
  readonly table: Table
  readonly op: 'insert' | 'update'
  readonly incoming: Readonly<Record<string, unknown>>
  readonly old: Readonly<Record<string, unknown>> | undefined
}): readonly FieldDecision[] => {
  const { table, op, incoming, old } = params
  return (table.fields ?? [])
    .filter(isAiComputeField)
    .filter((f) => firesFor(f, op))
    .map((field) => {
      const decision = applyBaselineGuard({
        op,
        kind: field.type,
        incoming: incoming[field.name],
        old: old?.[field.name],
        sourceChanged: sourceChanged(field.sourceFields, incoming, old),
      })
      return { field, preserved: decision.kind === 'preserve' }
    })
}

const buildRefinementInput = (params: {
  readonly app: App
  readonly table: Table
  readonly recordId: string | number
  readonly record: Readonly<Record<string, unknown>>
  readonly field: AiComputeField
}): RefineAiComputeFieldInput => {
  const { app, table, recordId, record, field } = params
  return {
    appId: app.name,
    tableName: table.name,
    recordId: String(recordId),
    fieldName: field.name,
    kind: field.type,
    source: buildSource(field.sourceFields, record),
    baselineValue: record[field.name],
    config: fieldToRequestConfig(field.type, field as Readonly<Record<string, unknown>>),
  }
}

/**
 * Label a fan-out branch and make it total.
 *
 * Catches both a typed failure of the ai-compute store and a DEFECT, neither of
 * which must escape into whatever fiber ends up carrying this work. Logging it
 * with the branch name is the only diagnosis an operator gets: the write that
 * triggered it has long since answered 200.
 *
 * `Effect.tapCause` sees both channels, so the branch name is attached either
 * way — which is the whole point of the label.
 */
const labelled = <E, R>(
  program: Effect.Effect<unknown, E, R>,
  label: string
): Effect.Effect<void, never, R> =>
  program.pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => {
        logError('[ai-compute] detached program failed', Cause.squash(cause), { label })
      })
    ),
    // effect-swallow: see the tap above — the cause is logged with its branch
    // name first. This runs after the record write has answered, so there is
    // nobody left to fail.
    Effect.ignore
  )

/**
 * AI-compute write-phase signal fan-out for one persisted record. For each
 * firing field: a user override is recorded as `skipped` (both dialects); a
 * computed field is enqueued to the shared worker on SQLite (Postgres uses the
 * NOTIFY listener). Gated for non-AI tables.
 *
 * RETURNS A DESCRIPTION, NOT A RUNNING FIBER. This used to start its own root
 * fiber per branch — detached from the write that caused it, outside its trace,
 * and binding a fresh `AiLive` every time. The caller decides how to detach it
 * now, which is the only place that knows whether there is a fiber to fork from
 * (standing rule E1). TODO(W4): the two detach sites below should hand their
 * fiber to the server runtime's scope once that scope owns long-lived work,
 * rather than each detaching on its own.
 *
 * @param incoming the user-supplied field map for this write (override detection)
 * @param old      the pre-update stored record (UPDATE only)
 * @param record   the persisted record fields (baseline already written)
 */
export const signalAiComputeWritePhase = (params: {
  readonly app: App
  readonly tableName: string
  readonly op: 'insert' | 'update'
  readonly recordId: string | number
  readonly incoming: Readonly<Record<string, unknown>>
  readonly old?: Readonly<Record<string, unknown>> | undefined
  readonly record: Readonly<Record<string, unknown>>
}): Effect.Effect<void, never, AiService> => {
  const { app, tableName, op, recordId, incoming, old, record } = params
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table) return Effect.void
  const decisions = resolveFieldDecisions({ table, op, incoming, old })

  // A hand-written column is `skipped` whatever its `computeOn` says, so this
  // set is resolved OUTSIDE the `firesFor` filter that produced `decisions`.
  // Unioned with the guard's own overrides (deduplicated by field name) so the
  // two never issue competing writes for the same field.
  const authored = userAuthoredAiFields(table, incoming)
  const authoredNames = new Set(authored.map((f) => f.name))
  const overrides = [
    ...authored,
    ...decisions.filter((d) => d.preserved && !authoredNames.has(d.field.name)).map((d) => d.field),
  ]
  const computed = decisions.filter((d) => !d.preserved && !authoredNames.has(d.field.name))

  if (overrides.length === 0 && computed.length === 0) return Effect.void

  // Override → `skipped` (both dialects; the only signal for the override case).
  const overrideBranch =
    overrides.length > 0
      ? labelled(
          writeSkippedStatuses({ appId: app.name, tableName, recordId, fields: overrides }),
          'override-skipped'
        )
      : Effect.void

  // Computed → enqueue the worker on SQLite only (Postgres uses the listener).
  const computedBranch =
    isSqliteRuntime() && computed.length > 0
      ? labelled(
          Effect.forEach(
            computed.map((d) =>
              buildRefinementInput({ app, table, recordId, record, field: d.field })
            ),
            (input) => refineAiComputeField(input),
            { discard: true }
          ),
          'sqlite-refinement-enqueue'
        )
      : Effect.void

  // Fixed-width literal fan-out (2), not data-dependent: the per-branch widths
  // are bounded inside each branch.
  return Effect.all([overrideBranch, computedBranch], { discard: true }).pipe(
    Effect.withSpan('ai-compute.signal-ai-compute-write-phase')
  )
}
