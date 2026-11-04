/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ORDER every bulk write runs its steps in, over abstract steps so the
 * unit tests can pin it, and the record event one committed row change is.
 * The bound steps and the five bulk writes that use this live in
 * `record-batch-orchestration.ts`, whose header documents the order.
 */

import { Effect } from 'effect'
import { transformRecord } from '@/domain/models/app/tables/record-transformer-service'
import { storedRowOf } from './record-stored-row'
import type { WebhookWriteKind } from './record-webhook-outbox'
import type { CommittedRowChange } from '@/application/ports/services/record-change-feed'
import type { OutboxedWrite } from '@/application/ports/services/record-webhook-dispatcher'
import type { TriggerRequester } from '@/application/use-cases/automations/resolve-trigger-data'
import type { TriggerRecordEventInput } from '@/application/use-cases/automations/trigger-record-event'
import type { App } from '@/domain/models/app'

/** One row event a bulk write fires. */
export type RowEvent = TriggerRecordEventInput

/** The record event one committed row change is, for the record automations. */
export function rowEventOf(
  input: {
    readonly app: App
    readonly tableName: string
    readonly userId: string
    readonly requester?: TriggerRequester
  },
  change: CommittedRowChange,
  kind: WebhookWriteKind
): RowEvent {
  const event = rowEventWithoutRequester(input, change, kind)
  return input.requester === undefined ? event : { ...event, requester: input.requester }
}

function rowEventWithoutRequester(
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
    readonly requester?: TriggerRequester
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
