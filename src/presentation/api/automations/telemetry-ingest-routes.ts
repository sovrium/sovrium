/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { declaresTelemetryProtocol } from '@/domain/models/app/automations/trigger/webhook-telemetry-service'
import { acceptsUploadBody } from '@/presentation/api/middleware/request-body-limit'
import { handleOtlpLogs, handleSentryEnvelope } from './telemetry-ingest-handler'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * The standard paths of each telemetry protocol an automation declares, and
 * only those: an app declaring none answers 404 there, as for any unknown
 * path. The Sentry envelope path is served with and without its trailing
 * slash. `/v1/logs` sits at the root, where every OTLP exporter appends it to
 * its endpoint, outside the `/api/*` guards; the handler applies its own key,
 * budget and body limit. Neither path counts against the per-address API
 * ceiling (`api-ip-ceiling.ts`).
 */
export const chainTelemetryIngestRoutes = <T extends Hono>(honoApp: T, app: App): T => {
  // Its own streamed cap (`telemetry-ingest-body.ts`), not the 1 MiB `/api/*` one.
  const sentryEnvelope = acceptsUploadBody((c: Context) => handleSentryEnvelope(c, app))
  const withSentry = declaresTelemetryProtocol(app.automations, 'sentry')
    ? (honoApp
        .post('/api/:project/envelope', sentryEnvelope)
        .post('/api/:project/envelope/', sentryEnvelope) as T)
    : honoApp
  return declaresTelemetryProtocol(app.automations, 'otlp-logs')
    ? (withSentry.post('/v1/logs', (c) => handleOtlpLogs(c, app)) as T)
    : withSentry
}
