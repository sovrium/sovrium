/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { CommittedRowChange } from './record-change-feed'
import type { App } from '@/domain/models/app'
import type { Effect } from 'effect'

/**
 * The port a record write fires its table's webhooks through.
 *
 * Every webhook delivery a write owes is an OUTBOX row, recorded inside the
 * write's own transaction: a rolled-back write leaves no delivery, and a
 * committed one cannot lose its delivery to a process that stops between the
 * commit and the first attempt. The write orchestrations hold the two halves:
 *
 *  1. {@link RecordWebhookDispatcher} `enqueue` runs the write with an outbox
 *     scope installed ({@link WebhookOutboxScope}). The table repositories, which
 *     already report each committed row change to the change stream, hand the
 *     same change to the scope's planner INSIDE their transaction and record
 *     the deliveries it plans in the same commit.
 *  2. `deliver` attempts the deliveries the write recorded, once it committed —
 *     awaited on a single-row road, in a tracked background fiber on a bulk one.
 *     A failure is retried per the webhook's `retry` policy, parked when the
 *     next retry is far off, and picked up again by the sweep (`deliverDue`).
 *
 * A required `Context.Service`, never a reference with a do-nothing default: a
 * runtime that writes records through the orchestrations and forgets to
 * provide it fails to type-check rather than silently dropping webhooks.
 *
 * A write with no scope installed — the seed, a backup restore, an import into
 * a table declaring `import: { fireEvents: false }` — records nothing.
 */

/** The events a table webhook can subscribe to. */
export type RecordWebhookEvent = 'create' | 'update' | 'delete' | 'restore'

/** One delivery a committed row change owes one webhook, planned inside the write. */
export interface PlannedDelivery {
  /** The delivery id: sent on every attempt as `X-Sovrium-Delivery-Id`. */
  readonly id: string
  readonly tableName: string
  readonly webhookName: string
  readonly event: RecordWebhookEvent
  readonly recordId: string
  /** The body as built at write time, after the webhook's `payload` options. Never a credential. */
  readonly payload: Readonly<Record<string, unknown>>
  /** The users the payload names, so erasing one removes the delivery. */
  readonly subjects: readonly string[]
}

/** Plans the deliveries a set of committed row changes owes. Pure: called inside a transaction. */
export type OutboxPlanner = (changes: readonly CommittedRowChange[]) => readonly PlannedDelivery[]

/** What one committed transaction recorded: its row changes, and the deliveries they owe. */
export interface RecordedDeliveries {
  readonly changes: readonly CommittedRowChange[]
  readonly deliveryIds: readonly string[]
}

/** The outbox scope a write runs in. */
export interface WebhookOutboxScopeShape {
  /** `true` inside a scope; a nested scope then records into the outer one. */
  readonly active: boolean
  readonly plan: OutboxPlanner
  /** Hand back what a transaction recorded, once it committed. */
  readonly recorded: (recorded: RecordedDeliveries) => void
}

const IDLE_SCOPE: WebhookOutboxScopeShape = {
  active: false,
  plan: () => [],
  recorded: () => undefined,
}

/**
 * The outbox scope in effect. Outside any scope a write records no delivery —
 * the reference's default, which is what keeps the seed and a backup restore
 * silent without a parameter on the write.
 */
export const WebhookOutboxScope = Context.Reference<WebhookOutboxScopeShape>(
  'sovrium/WebhookOutboxScope',
  { defaultValue: () => IDLE_SCOPE }
)

/**
 * A write run with its deliveries recorded: its own answer, the row changes it
 * committed (a bulk write's per-row side effects read them), and the delivery
 * ids it owes.
 */
export interface OutboxedWrite<A> {
  readonly value: A
  readonly changes: readonly CommittedRowChange[]
  readonly deliveryIds: readonly string[]
}

/** What one sweep of the due deliveries did, by delivery id. */
export interface OutboxSweepReport {
  readonly delivered: readonly string[]
  readonly retrying: readonly string[]
  readonly dead: readonly string[]
}

/** When a write waits for its deliveries. */
export type DeliveryMode = 'await' | 'background'

export class RecordWebhookDispatcher extends Context.Service<
  RecordWebhookDispatcher,
  {
    /**
     * Run `write` with its committed row changes recorded as outbox rows in
     * their own transaction, as `plan` decides. Resolves to the write's value
     * and the delivery ids it recorded (none for a write that failed).
     */
    readonly enqueue: <A, E, R>(
      plan: OutboxPlanner,
      write: Effect.Effect<A, E, R>
    ) => Effect.Effect<OutboxedWrite<A>, E, R>
    /**
     * Attempt the deliveries a committed write recorded. Total: a receiver
     * that is down, slow or missing never fails the write that fired it.
     */
    readonly deliver: (input: {
      readonly app: App
      readonly deliveryIds: readonly string[]
      readonly mode: DeliveryMode
    }) => Effect.Effect<void>
    /**
     * Attempt every delivery that is due, at most a bounded batch per call,
     * after deleting what the seven-day retention no longer keeps. Retention
     * runs on every call unless `retention` is `'hourly'` — the minute tick's
     * bound, so it deletes at most once an hour.
     */
    readonly deliverDue: (
      app: App,
      options?: { readonly retention?: 'every-call' | 'hourly' }
    ) => Effect.Effect<OutboxSweepReport>
  }
>()('RecordWebhookDispatcher') {}
