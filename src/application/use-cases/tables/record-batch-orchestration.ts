/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE path each bulk write takes — batch create, update, delete and
 * restore, and upsert — with the side effects it carries, whichever road it
 * came through: the records API's batch and upsert endpoints, the CSV import,
 * the native bulk forms and an automation's batch steps. Each road keeps its
 * own authorization; this program authorizes nothing.
 *
 * A bulk write of N rows carries the side effects of N single-row writes: one
 * record event per row, in the record vocabulary (`create`, `update`,
 * `delete`, `restore`) — never one batch envelope, so a webhook receiver and
 * an automation read one record per event whatever road wrote it. The order is
 * fixed, and the unit tests pin it:
 *
 *  1. write, recording the table's webhook deliveries for every committed row
 *     in the same transaction (create: the SQLite AI-compute baseline merged
 *     into every row first)
 *  2. the write's own follow-up (update: signal the AI columns the caller wrote
 *     by hand, detached; delete: a failure is logged, then reported)
 *  3. dispatch the table's record automations, one event per committed row —
 *     in a tracked background fiber, so the call answers as fast as before
 *  4. deliver the webhook deliveries the write recorded, in the background too
 *  5. log one line: the rows written, the deliveries and the events queued
 *
 * A CSV import into a table declaring `import: { fireEvents: false }` is the
 * one bulk write that records no delivery and skips steps 3 and 4 — the
 * realtime change stream still announces its rows.
 */

import { Effect } from 'effect'
import { AutomationFiberBridge } from '@/application/ports/services/automation-fiber-bridge'
import {
  markUserAuthoredAiFieldsForRecords,
  type AiComputeBatchWrite,
} from '@/application/use-cases/ai-compute/enqueue-refinement'
import { triggerRecordEventAutomations } from '@/application/use-cases/automations/trigger-record-event'
import { logError, logInfo } from '@/infrastructure/logging/logger'
import {
  batchCreateProgram,
  batchDeleteProgram,
  batchRestoreProgram,
  batchUpdateProgram,
  upsertProgram,
} from './batch-operations'
import { mergeCreateAiBaseline } from './record-create-orchestration'
import { storedRowOf } from './record-stored-row'
import { transformRecord } from './record-transformer'
import {
  deliverRecordWebhooks,
  withRecordWebhooks,
  type WebhookWriteKind,
} from './record-webhook-outbox'
import type { LinkReader } from './linked-row-visibility'
import type { StoredRow } from './record-update-orchestration'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { CommittedRowChange } from '@/application/ports/services/record-change-feed'
import type {
  DeliveryMode,
  OutboxedWrite,
} from '@/application/ports/services/record-webhook-dispatcher'
import type { TriggerRecordEventInput } from '@/application/use-cases/automations/trigger-record-event'
import type { App } from '@/domain/models/app'

/** The caller and the table one bulk write addresses, and how its events fire. */
export interface BatchScope {
  readonly session: Readonly<UserSession>
  readonly app: App
  readonly tableName: string
  /** Process env captured at the route boundary, for the automations' `$env` lookups. */
  readonly processEnv: Readonly<Record<string, string | undefined>>
  /**
   * Whether the write fires the table's webhooks and record automations. Only
   * a CSV import into a table declaring `import: { fireEvents: false }` turns
   * it off; every other road fires.
   */
  readonly fireEvents?: boolean
  /** Whether the call waits for its webhook deliveries; a bulk write does not, by default. */
  readonly deliveryMode?: DeliveryMode
}

/** A bulk write that echoes the records it wrote. */
interface EchoingBatch extends BatchScope {
  readonly returnRecords?: boolean
  /** Whose read rules judge the rows the batch links to. */
  readonly linkReader: LinkReader
}

/** A row event, before the process env of the road is attached. */
export type RowEvent = Omit<TriggerRecordEventInput, 'processEnv'>

/** The record event one committed row change is, for the record automations. */
export function rowEventOf(
  input: { readonly app: App; readonly tableName: string; readonly userId: string },
  change: CommittedRowChange,
  kind: WebhookWriteKind
): RowEvent {
  const { app, tableName, userId } = input
  if (change.event === 'delete') {
    return { app, tableName, userId, event: 'delete', record: { ...change.previous } }
  }
  const record = { ...storedRowOf(transformRecord(change.row ?? {}, { app, tableName })) }
  if (change.event === 'update') {
    return {
      ...{ app, tableName, userId, event: 'update' as const, record },
      ...(change.previous === undefined ? {} : { previousRecord: { ...change.previous } }),
    }
  }
  return { app, tableName, userId, event: kind === 'restore' ? 'restore' : 'create', record }
}

/** What one bulk write did, for its log line. */
export interface BulkWriteSummary {
  readonly rows: number
  readonly deliveries: number
  readonly events: number
}

/** The steps every bulk write is made of, so the ORDER is unit-testable. */
export interface BulkWriteSteps<A, E, RW, RA, RE, RD> {
  readonly write: Effect.Effect<OutboxedWrite<A>, E, RW>
  /** The write's own follow-up once it committed (an AI signal). */
  readonly afterWrite?: Effect.Effect<void, never, RA>
  /** Reports a failed write before it is kept as the write's own error. */
  readonly reportFailure?: (error: E) => Effect.Effect<void>
  readonly dispatchRowEvents: (events: readonly RowEvent[]) => Effect.Effect<void, never, RE>
  readonly deliverWebhooks: (deliveryIds: readonly string[]) => Effect.Effect<void, never, RD>
  readonly report: (summary: BulkWriteSummary) => Effect.Effect<void>
}

/**
 * The bulk write, in the order the module header documents, over abstract
 * steps. `fireEvents: false` dispatches no event (the write recorded no delivery).
 */
export function orchestrateBulkWrite<A, E, RW, RA = never, RE = never, RD = never>(
  input: {
    readonly app: App
    readonly tableName: string
    readonly userId: string
    readonly kind: WebhookWriteKind
    readonly fireEvents: boolean
  },
  steps: BulkWriteSteps<A, E, RW, RA, RE, RD>
): Effect.Effect<A, E, RW | RA | RE | RD> {
  const { tableName } = input
  return Effect.gen(function* () {
    const { reportFailure } = steps
    const written = yield* reportFailure === undefined
      ? steps.write
      : steps.write.pipe(Effect.tapError(reportFailure))
    if (steps.afterWrite !== undefined) yield* steps.afterWrite
    const rows = written.changes.filter((change) => change.tableName === tableName)
    const events = input.fireEvents ? rows.map((row) => rowEventOf(input, row, input.kind)) : []
    if (events.length > 0) yield* steps.dispatchRowEvents(events)
    yield* steps.deliverWebhooks(written.deliveryIds)
    yield* steps.report({
      rows: rows.length,
      deliveries: written.deliveryIds.length,
      events: events.length,
    })
    return written.value
  }).pipe(Effect.withSpan('tables.orchestrate-bulk-write', { attributes: { tableName } }))
}

/**
 * Start the record automations of every row event. The records API's own
 * dispatch runs them in a tracked background fiber — a 10 000-row import
 * answers as fast as a one-row one, and a stopping server waits for them or
 * records them as stopped — one event after another, each automation under
 * its own `concurrency`.
 */
const dispatchRowEventsFor = (scope: BatchScope) => (events: readonly RowEvent[]) => {
  const inputs = events.map((event) => ({ ...event, processEnv: scope.processEnv }))
  return AutomationFiberBridge.use((bridge) =>
    Effect.asVoid(
      Effect.forkDetach(
        bridge.trackBackground(
          Effect.forEach(inputs, triggerRecordEventAutomations, { discard: true })
        )
      )
    )
  )
}

/** One line per bulk write: what it wrote and what it queued. */
const reportFor = (scope: BatchScope) => (summary: BulkWriteSummary) =>
  summary.rows < 2
    ? Effect.void
    : Effect.sync(() =>
        logInfo(
          `[tables] bulk write into '${scope.tableName}': ${String(summary.rows)} rows, ${String(summary.deliveries)} webhook deliveries and ${String(summary.events)} record events queued`
        )
      )

/** The orchestration's bound steps, shared by every bulk write. */
const boundSteps = <A, E, R>(scope: BatchScope, write: Effect.Effect<OutboxedWrite<A>, E, R>) => ({
  write,
  dispatchRowEvents: dispatchRowEventsFor(scope),
  deliverWebhooks: (deliveryIds: readonly string[]) =>
    deliverRecordWebhooks(scope.app, deliveryIds, scope.deliveryMode ?? 'background'),
  report: reportFor(scope),
})

/** A write run with no outbox scope: no delivery recorded, no row change handed back. */
const silently = <A, E, R>(write: Effect.Effect<A, E, R>) =>
  Effect.map(write, (value): OutboxedWrite<A> => ({ value, changes: [], deliveryIds: [] }))

/** The write, inside the outbox scope unless the road was made silent. */
const outboxed =
  (scope: BatchScope, kind: WebhookWriteKind = 'write') =>
  <A, E, R>(write: Effect.Effect<A, E, R>) =>
    scope.fireEvents === false
      ? silently(write)
      : write.pipe(withRecordWebhooks(scope.app, scope.tableName, kind))

const bulkInput = (scope: BatchScope, kind: WebhookWriteKind = 'write') => ({
  app: scope.app,
  tableName: scope.tableName,
  userId: scope.session.userId,
  kind,
  fireEvents: scope.fireEvents !== false,
})

/** Create a batch of records and run the side effects a batch create carries. */
export function batchCreateWithSideEffects(
  input: EchoingBatch & {
    /** The validated fields of each row, as the caller asked to write them. */
    readonly rows: readonly StoredRow[]
    readonly isSqlite: boolean
  }
) {
  const { session, app, tableName, linkReader } = input
  const write = batchCreateProgram({
    ...{ session, tableName, app, linkReader },
    recordsData: input.rows.map((fields) => ({
      ...mergeCreateAiBaseline(input, fields, input.isSqlite),
    })),
    ...(input.returnRecords === undefined ? {} : { returnRecords: input.returnRecords }),
  }).pipe(outboxed(input))
  return orchestrateBulkWrite(bulkInput(input), boundSteps(input, write)).pipe(
    Effect.withSpan('tables.batch-create-with-side-effects', { attributes: { tableName } })
  )
}

/** Update a batch of records and run the side effects a batch update carries. */
export function batchUpdateWithSideEffects(
  input: EchoingBatch & {
    /** Each record's id paired with exactly the fields the caller may write. */
    readonly records: readonly (AiComputeBatchWrite & { readonly id: string })[]
  }
) {
  const { session, app, tableName, linkReader, records } = input
  const write = batchUpdateProgram({
    ...{ session, tableName, app, linkReader },
    recordsData: records.map((record) => ({ id: record.id, fields: { ...record.fields } })),
    ...(input.returnRecords === undefined ? {} : { returnRecords: input.returnRecords }),
  }).pipe(outboxed(input))
  return orchestrateBulkWrite(bulkInput(input), {
    ...boundSteps(input, write),
    // Detached: the status writes outlive the request, and read the same
    // services this program was provided.
    afterWrite: Effect.asVoid(
      Effect.forkDetach(markUserAuthoredAiFieldsForRecords({ app, tableName, records }))
    ),
  }).pipe(Effect.withSpan('tables.batch-update-with-side-effects', { attributes: { tableName } }))
}

/** Delete a batch of records — to the trash, or for good — and log a failure. */
export function batchDeleteWithSideEffects(
  input: BatchScope & { readonly ids: readonly string[]; readonly permanent: boolean }
) {
  const { session, app, tableName, ids, permanent } = input
  const write = batchDeleteProgram(session, tableName, ids, { permanent, app }).pipe(
    outboxed(input)
  )
  return orchestrateBulkWrite(bulkInput(input), {
    ...boundSteps(input, write),
    reportFailure: (error: unknown) =>
      Effect.sync(() =>
        logError(`[tables] batch ${permanent ? 'hard-' : 'soft-'}delete failed`, error)
      ),
  }).pipe(Effect.withSpan('tables.batch-delete-with-side-effects', { attributes: { tableName } }))
}

/** Restore a batch of records from the trash: one `restore` event per record brought back. */
export function batchRestoreWithSideEffects(
  input: BatchScope & { readonly ids: readonly string[] }
) {
  const { session, app, tableName, ids } = input
  const write = batchRestoreProgram(session, tableName, ids, app).pipe(outboxed(input, 'restore'))
  return orchestrateBulkWrite(bulkInput(input, 'restore'), boundSteps(input, write)).pipe(
    Effect.withSpan('tables.batch-restore-with-side-effects', { attributes: { tableName } })
  )
}

/**
 * Create or update each row by its merge fields: a `create` event for a row
 * inserted, an `update` event — with the row as it stood — for a row matched,
 * even when its values did not change, as a `PATCH` with the same values does.
 */
export function upsertWithSideEffects(
  input: BatchScope & {
    readonly recordsData: readonly Record<string, unknown>[]
    readonly fieldsToMergeOn: readonly string[]
    /** Rows the caller's row-level read rule hides: never a match. */
    readonly hiddenIds?: readonly string[]
    readonly returnRecords: boolean
    readonly linkReader?: LinkReader
  }
) {
  const { session, app, tableName } = input
  const write = upsertProgram(session, tableName, {
    recordsData: input.recordsData,
    fieldsToMergeOn: input.fieldsToMergeOn,
    ...(input.hiddenIds === undefined ? {} : { hiddenIds: input.hiddenIds }),
    returnRecords: input.returnRecords,
    app,
    ...(input.linkReader === undefined ? {} : { linkReader: input.linkReader }),
  }).pipe(outboxed(input))
  return orchestrateBulkWrite(bulkInput(input), boundSteps(input, write)).pipe(
    Effect.withSpan('tables.upsert-with-side-effects', { attributes: { tableName } })
  )
}
