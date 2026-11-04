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
 *  0. clean every row's values and check their formats (`record-write-values.ts`),
 *     then judge the table's business rules on every row: one malformed
 *     address or one broken rule refuses the whole batch, nothing written
 *     (`batch-business-rules.ts`)
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
import {
  markUserAuthoredAiFieldsForRecords,
  signalAiComputeForBatchCreate,
  type AiComputeBatchWrite,
} from '@/application/use-cases/ai/enqueue-refinement'
import { startRecordEventAutomationsInBackground } from '@/application/use-cases/automations/record-event-background'
import { startInTrackedBackground } from '@/application/use-cases/automations/tracked-background'
import { isBusinessRuleViolationError } from '@/domain/errors'
import { logError, logInfo } from '@/infrastructure/logging/logger'
import {
  authorizeBatchCreateRules,
  authorizeBatchDeleteRules,
  authorizeBatchRestoreRules,
  authorizeBatchUpdateRules,
  authorizeUpsertRules,
} from './batch-business-rules'
import {
  batchCreateProgram,
  batchDeleteProgram,
  batchRestoreProgram,
  batchUpdateProgram,
  upsertProgram,
} from './batch-operations'
import {
  orchestrateBulkWrite,
  type BulkWriteSummary,
  type RowEvent,
} from './record-bulk-write-order'
import { engineMergesAiBaseline, mergeCreateAiBaseline } from './record-create-orchestration'
import {
  deliverRecordWebhooks,
  withRecordWebhooks,
  type WebhookWriteKind,
} from './record-webhook-outbox'
import { checkedWriteRows } from './record-write-values'
import type { LinkReader } from './linked-row-visibility'
import type { StoredRow } from './record-update-orchestration'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type {
  DeliveryMode,
  OutboxedWrite,
} from '@/application/ports/services/record-webhook-dispatcher'
import type { TriggerRequester } from '@/application/use-cases/automations/resolve-trigger-data'
import type { App } from '@/domain/models/app'

/** The caller and the table one bulk write addresses, and how its events fire. */
export interface BatchScope {
  readonly session: Readonly<UserSession>
  readonly app: App
  readonly tableName: string
  /**
   * Whether the write fires the table's webhooks and record automations. Only
   * a CSV import into a table declaring `import: { fireEvents: false }` turns
   * it off; every other road fires.
   */
  readonly fireEvents?: boolean
  /** Whether the call waits for its webhook deliveries; a bulk write does not, by default. */
  readonly deliveryMode?: DeliveryMode
  /** Who made the write, as each row's `trigger.user`: absent for a write no person made. */
  readonly requester?: TriggerRequester
  readonly userGroups?: readonly string[]
}

/** A bulk write that echoes the records it wrote. */
interface EchoingBatch extends BatchScope {
  readonly returnRecords?: boolean
  /** Whose read rules judge the rows the batch links to. */
  readonly linkReader: LinkReader
}

/**
 * Start the record automations of every row event. The records API's own
 * dispatch runs them in a tracked background fiber — a 10 000-row import
 * answers as fast as a one-row one, and a stopping server waits for them or
 * records them as stopped — one event after another, each automation under
 * its own `concurrency`.
 */
const dispatchRowEvents = (events: readonly RowEvent[]) =>
  startRecordEventAutomationsInBackground(events)

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
  dispatchRowEvents,
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

/** The rules' scope for a bulk write: her role exempts; her role and groups bound what a refusal names. */
const ruleScope = (scope: BatchScope) => ({
  ...{ session: scope.session, app: scope.app, tableName: scope.tableName },
  ...{ userRole: scope.requester?.role, userGroups: scope.userGroups },
})

const bulkInput = (scope: BatchScope, kind: WebhookWriteKind = 'write') => ({
  app: scope.app,
  tableName: scope.tableName,
  userId: scope.session.userId,
  ...(scope.requester === undefined ? {} : { requester: scope.requester }),
  kind,
  fireEvents: scope.fireEvents !== false,
})

/** Create a batch of records and run the side effects a batch create carries. */
export function batchCreateWithSideEffects(
  input: EchoingBatch & {
    /** The validated fields of each row, as the caller asked to write them. */
    readonly rows: readonly StoredRow[]
  }
) {
  const { session, app, tableName, linkReader } = input
  const write = checkedWriteRows(app, tableName, input.rows).pipe(
    Effect.tap((rows) => authorizeBatchCreateRules(ruleScope(input), rows)),
    Effect.zip(engineMergesAiBaseline),
    Effect.flatMap(([rows, isSqlite]) =>
      batchCreateProgram({
        ...{ session, tableName, app, linkReader },
        recordsData: rows.map((fields) => ({
          ...mergeCreateAiBaseline(input, fields, isSqlite),
        })),
        ...(input.returnRecords === undefined ? {} : { returnRecords: input.returnRecords }),
      })
    ),
    outboxed(input),
    Effect.tap(({ changes }) =>
      startInTrackedBackground(signalAiComputeForBatchCreate({ ...input, changes }))
    )
  )
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
  const write = checkedWriteRows(
    app,
    tableName,
    records.map((record) => record.fields)
  ).pipe(
    Effect.map((rows) =>
      records.map((record, index) => ({ id: record.id, fields: { ...rows[index] } }))
    ),
    Effect.flatMap((recordsData) =>
      Effect.map(authorizeBatchUpdateRules(ruleScope(input), recordsData), (judge) => ({
        recordsData,
        judge,
      }))
    ),
    Effect.flatMap(({ recordsData, judge }) =>
      batchUpdateProgram({
        ...{ session, tableName, app, linkReader, recordsData, judge },
        ...(input.returnRecords === undefined ? {} : { returnRecords: input.returnRecords }),
      })
    ),
    outboxed(input)
  )
  return orchestrateBulkWrite(bulkInput(input), {
    ...boundSteps(input, write),
    // In the tracked background: the status writes outlive the request, drain
    // with the server, and read the same services this program was provided.
    afterWrite: startInTrackedBackground(
      markUserAuthoredAiFieldsForRecords({ app, tableName, records })
    ),
  }).pipe(Effect.withSpan('tables.batch-update-with-side-effects', { attributes: { tableName } }))
}

/** Delete a batch of records — to the trash, or for good — and log a failure. */
export function batchDeleteWithSideEffects(
  input: BatchScope & { readonly ids: readonly string[]; readonly permanent: boolean }
) {
  const { session, app, tableName, ids, permanent } = input
  const write = authorizeBatchDeleteRules(ruleScope(input), ids, permanent).pipe(
    Effect.flatMap((judge) =>
      batchDeleteProgram(session, tableName, ids, { permanent, app, judge })
    ),
    outboxed(input)
  )
  return orchestrateBulkWrite(bulkInput(input), {
    ...boundSteps(input, write),
    // A rule refusing the delete is the caller's answer, not a failure to log.
    reportFailure: (error: unknown) =>
      isBusinessRuleViolationError(error)
        ? Effect.void
        : Effect.sync(() =>
            logError(`[tables] batch ${permanent ? 'hard-' : 'soft-'}delete failed`, error)
          ),
  }).pipe(Effect.withSpan('tables.batch-delete-with-side-effects', { attributes: { tableName } }))
}

/** Restore a batch of records from the trash: one `restore` event per record brought back. */
export function batchRestoreWithSideEffects(
  input: BatchScope & { readonly ids: readonly string[] }
) {
  const { session, app, tableName, ids } = input
  const write = Effect.flatMap(authorizeBatchRestoreRules(ruleScope(input), ids), (judge) =>
    batchRestoreProgram(session, tableName, ids, { app, judge })
  ).pipe(outboxed(input, 'restore'))
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
  const mergeOf = (recordsData: readonly StoredRow[]) => ({
    recordsData: recordsData.map((row) => ({ ...row })),
    fieldsToMergeOn: input.fieldsToMergeOn,
    ...(input.hiddenIds === undefined ? {} : { hiddenIds: input.hiddenIds }),
  })
  const write = checkedWriteRows(app, tableName, input.recordsData).pipe(
    Effect.map(mergeOf),
    Effect.flatMap((merge) =>
      Effect.flatMap(authorizeUpsertRules(ruleScope(input), merge), (judge) =>
        upsertProgram(session, tableName, {
          ...{ ...merge, judge, app },
          returnRecords: input.returnRecords,
          ...(input.linkReader === undefined ? {} : { linkReader: input.linkReader }),
        })
      )
    ),
    outboxed(input)
  )
  return orchestrateBulkWrite(bulkInput(input), boundSteps(input, write)).pipe(
    Effect.withSpan('tables.upsert-with-side-effects', { attributes: { tableName } })
  )
}
