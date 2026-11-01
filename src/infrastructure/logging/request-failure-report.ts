/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isIngestRequest } from '@/infrastructure/logging/ingest-request-scope'
import { reportException } from '@/infrastructure/telemetry/error-reporter'
import { isOperatorActionable } from '@/infrastructure/telemetry/telemetry-sink'

/**
 * Report a failure a request ended in to the telemetry backend, WITH the
 * request as its context (fire-and-forget, a no-op unless SENTRY_DSN is set).
 *
 * Call it BEFORE the `logError` that carries the same error: the reporter dedups
 * on the error object, so the report that keeps the request is the one sent.
 * Gated on the predicate that `logError` path uses, so the two agree: a 4xx that
 * is the caller's own fault is a log line, not an operator's page. A failure
 * while serving a telemetry ingest request is never reported: the app may be its
 * own receiver ([internal ref] D2 a).
 *
 * Both last rungs of a request go through here: the server's error boundary, and
 * the handler runner's sanitized answer.
 */
export const reportRequestFailure = (
  request: Request,
  error: unknown,
  report: typeof reportException = reportException
): void => {
  if (isOperatorActionable(error) && !isIngestRequest(request)) {
    void report(error, {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
    })
  }
}
