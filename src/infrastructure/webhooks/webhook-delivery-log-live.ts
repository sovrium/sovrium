/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import {
  WebhookDeliveryLog,
  WebhookDeliveryLogError,
} from '@/application/ports/services/webhook-delivery-log'
import { Database } from '@/infrastructure/database/drizzle/layer'
import { getDelivery, getDeliveryOutboxId, listDeliveries } from './delivery-log-queries'
import { deliverAndLog, deliverTestWebhook } from './table-webhook-dispatch'

/** One step of the delivery log, with its failure named. */
const attempt = <A>(run: () => Promise<A>): Effect.Effect<A, WebhookDeliveryLogError> =>
  Effect.tryPromise({ try: run, catch: (cause) => new WebhookDeliveryLogError({ cause }) })

/** The delivery log, over the `Database` service of the runtime. Part of `TableLive`. */
export const WebhookDeliveryLogLive = Layer.effect(
  WebhookDeliveryLog,
  Effect.map(Database, (database) =>
    WebhookDeliveryLog.of({
      list: (options) => attempt(() => listDeliveries(database, options)),
      get: (address) => attempt(() => getDelivery(database, address)),
      outboxIdOf: (logId) => attempt(() => getDeliveryOutboxId(database, logId)),
      resend: ({ app, ...input }) =>
        attempt(() => deliverAndLog(database, { ...input, appEnv: app.env })),
      sendTest: ({ app, ...input }) =>
        attempt(() => deliverTestWebhook(database, { ...input, appEnv: app.env })),
    })
  )
)
