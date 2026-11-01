/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a single-record write tells its caller about the table's webhooks.
 *
 * A write answers as soon as it is committed; the webhook deliveries it owes
 * are recorded with it and attempted in the background. The answer names
 * their ids in {@link DELIVERY_IDS_HEADER}, the same id each receiver reads on
 * every attempt of its delivery. A caller that wants the deliveries attempted
 * before the answer sends {@link AWAIT_HEADER}: the write then waits for them,
 * for one attempt's timeout at most, and answers anyway.
 */

import { Effect } from 'effect'
import { RecordWebhookReceipt } from '@/application/ports/services/record-webhook-dispatcher'
import type { Context } from 'hono'

/** The response header naming the ids of the deliveries the write recorded. */
export const DELIVERY_IDS_HEADER = 'X-Sovrium-Delivery-Ids'

/** The request header asking the write to wait for its deliveries. */
export const AWAIT_HEADER = 'X-Sovrium-Await-Deliveries'

/** Run `write` with the request's receipt: its wait choice, and where the ids go. */
export const withWebhookReceipt =
  (c: Context) =>
  <A, E, R>(write: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.provideService(write, RecordWebhookReceipt, {
      mode: c.req.header(AWAIT_HEADER)?.trim().toLowerCase() === 'true' ? 'await' : 'background',
      recorded: (deliveryIds) => {
        c.header(DELIVERY_IDS_HEADER, deliveryIds.join(', '), { append: true })
      },
    })
