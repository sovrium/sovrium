/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  WebhookDeliveryLog,
  type DeliveryAddress,
} from '@/application/ports/services/webhook-delivery-log'
import { rebuildRetryPayload } from '@/domain/models/app/tables/webhooks/delivery-retry-service'
import type { App } from '@/domain/models/app'
import type { Webhook } from '@/domain/models/app/tables/webhooks'

/**
 * Re-send the stored payload of a logged delivery. The retry writes a NEW
 * delivery-log row; the original stays as the audit record.
 *
 * @returns how the send ended, or `undefined` when no such delivery is logged
 */
export const retryWebhookDelivery = Effect.fn('tables.retry-webhook-delivery')(function* (input: {
  readonly app: App
  readonly webhook: Webhook
  readonly address: DeliveryAddress
}) {
  const { app, webhook, address } = input
  const log = yield* WebhookDeliveryLog
  const delivery = yield* log.get(address)
  if (delivery === undefined) return undefined
  // The stored envelope, re-read from its JSON text, under a fresh timestamp.
  const payload = rebuildRetryPayload({
    app,
    tableName: delivery.tableName,
    event: delivery.event,
    stored: delivery.payload,
    timestamp: new Date().toISOString(),
  })
  return yield* log.resend({
    webhook,
    tableName: address.tableName,
    payload,
    app,
    outboxDeliveryId: yield* log.outboxIdOf(address.deliveryId),
  })
})
