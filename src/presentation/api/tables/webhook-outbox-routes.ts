/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `POST /api/internal/webhooks/deliver-due` — run one sweep of the table
 * webhook outbox on demand: attempt every delivery that is due, and answer
 * `{ delivered: [ids], retrying: [ids], dead: [ids] }`, the delivery ids it
 * attempted by how each ended.
 *
 * The same sweep runs at every boot and every minute on its own
 * (`register-webhook-outbox.ts`); this route exists so a test can run it
 * deterministically. It is gated exactly like its siblings in
 * `notification-trigger-routes.ts`: without a matching
 * `X-Internal-Scheduler-Token` — and always, when `INTERNAL_SCHEDULER_TOKEN` is
 * unset, which is the production posture — it answers 404 as if it did not
 * exist.
 */

import { RecordWebhookDispatcher } from '@/application/ports/services/record-webhook-dispatcher'
import { provideDomain } from '@/infrastructure/logging/request-effect'
import {
  internalSchedulerNotFound,
  isInternalSchedulerRequest,
} from '@/presentation/api/runtime/internal-scheduler-gate'
import { runEffect } from '@/presentation/api/runtime/run-effect'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/** Sweep the due deliveries; answers `{ delivered, retrying, dead }`. */
async function handleDeliverDue(c: Context, app: App): Promise<Response> {
  if (!isInternalSchedulerRequest(c)) return internalSchedulerNotFound(c)
  return runEffect(
    c,
    provideDomain(
      c,
      RecordWebhookDispatcher.use((dispatcher) => dispatcher.deliverDue(app))
    )
  )
}

/**
 * Chain the webhook outbox trigger route onto a Hono app. Registered without a
 * session requirement: the scheduler token IS the gate.
 */
export function chainWebhookOutboxRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return honoApp.post('/api/internal/webhooks/deliver-due', (c) =>
    handleDeliverDue(c, resolveApp())
  ) as T
}
