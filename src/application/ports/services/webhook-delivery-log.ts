/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'
import type { App } from '@/domain/models/app'
import type { Webhook } from '@/domain/models/app/tables/webhooks'
import type { RetryEnvelope } from '@/domain/models/app/tables/webhooks/delivery-retry-service'

/**
 * The delivery log of a table's webhooks, and the two sends an administrator
 * asks for by hand: a retry of a logged delivery, and a test ping.
 */

/**
 * A single webhook delivery-log row, shaped for the API response.
 *
 * `status` is `success` / `failed` — the storage layer records exactly these
 * two values, so the wire contract and the stored value coincide.
 */
export interface DeliveryLogEntry {
  readonly id: string
  readonly webhookName: string
  readonly tableName: string
  readonly event: string
  readonly url: string
  readonly status: 'success' | 'failed'
  readonly httpStatus: number | undefined
  readonly attemptCount: number
  readonly error: string | undefined
  readonly responseBody: string | undefined
  readonly duration: number
  readonly requestedAt: string
  readonly completedAt: string
  readonly payload: unknown
  readonly requestHeaders: unknown
}

/** One page of the delivery log. */
export interface ListDeliveriesOptions {
  readonly tableName: string
  readonly webhookName: string
  readonly limit: number
  /** Keyset cursor: return rows with `id < cursor`. */
  readonly cursor: number | undefined
  readonly status: 'success' | 'failed' | undefined
}

/** A page of the delivery log, newest first. */
export interface ListDeliveriesResult {
  readonly deliveries: readonly DeliveryLogEntry[]
  readonly totalCount: number
  readonly nextCursor: string | undefined
}

/** One logged delivery, addressed within its table webhook. */
export interface DeliveryAddress {
  readonly tableName: string
  readonly webhookName: string
  readonly deliveryId: number
}

/** What a manual retry sends, and the delivery it re-sends. */
export interface ResendInput {
  readonly webhook: Webhook
  readonly tableName: string
  readonly payload: RetryEnvelope
  readonly app: App
  /** The outbox delivery being re-sent: its id rides on the retry, as on every attempt. */
  readonly outboxDeliveryId: string | undefined
}

/** What a manual retry reports: the new delivery-log row, and how the send ended. */
export interface ResendOutcome {
  readonly deliveryId: number | undefined
  readonly success: boolean
}

/** What a test ping sends. */
export interface SendTestInput {
  readonly webhook: Webhook
  readonly tableName: string
  readonly sampleRecord: Record<string, unknown>
  readonly app: App
}

/** How a test ping ended, surfaced by the test endpoint. */
export interface TestDeliveryResult {
  readonly success: boolean
  readonly httpStatus: number
  readonly duration: number
  readonly error: string | undefined
}

/** The delivery log could not be read or written. */
export class WebhookDeliveryLogError extends Data.TaggedError('WebhookDeliveryLogError')<{
  readonly cause: unknown
}> {}

/** The port the webhook management routes reach the delivery log through. */
export class WebhookDeliveryLog extends Context.Service<
  WebhookDeliveryLog,
  {
    readonly list: (
      options: ListDeliveriesOptions
    ) => Effect.Effect<ListDeliveriesResult, WebhookDeliveryLogError>
    readonly get: (
      address: DeliveryAddress
    ) => Effect.Effect<DeliveryLogEntry | undefined, WebhookDeliveryLogError>
    /** The outbox delivery a log row settled; `undefined` for a test send or an older row. */
    readonly outboxIdOf: (
      logId: number
    ) => Effect.Effect<string | undefined, WebhookDeliveryLogError>
    readonly resend: (input: ResendInput) => Effect.Effect<ResendOutcome, WebhookDeliveryLogError>
    readonly sendTest: (
      input: SendTestInput
    ) => Effect.Effect<TestDeliveryResult, WebhookDeliveryLogError>
  }
>()('WebhookDeliveryLog') {}
