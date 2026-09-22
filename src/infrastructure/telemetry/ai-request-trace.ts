/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AI service-layer seam instrumentation.
 *
 * `traceAiRequest` is the ONE wrapper the shared `AiService.chat` port applies
 * to its provider-call Effect (`AiLive` — the seam every AI surface funnels
 * through: the chat route, agent actions, AI-compute field refinement). It emits
 * BOTH signals for a single provider request, from the point where the resolved
 * provider + model + operation are known (never prompt text / message content /
 * user ids / keys — those never become labels or attributes):
 *
 *   1. an `ai.request` CHILD span carrying `{ provider, model, operation }`
 *      attributes. Being an `Effect.withSpan`, it chains under whatever span is
 *      current on the running fiber — so when the request runs through
 *      `runRequestEffect` (the request-edge root `http.server` span), the AI span
 *      chains under the request root, giving free request↔AI-request correlation.
 *      Off-request AI calls still CREATE the span: `Tracer.Tracer` is a
 *      `Context.Reference` whose `defaultValue` is a NATIVE tracer minting real
 *      `NativeSpan`s (`effect/Tracer.js`), so `withSpan` is never a no-op —
 *      with no collector listening it is one in-memory allocation, dropped
 *      unreferenced.
 *   2. `ai.request.duration` (histogram) + `ai.request.count` (sum) observations
 *      labeled `{ provider, model, operation }` (see `recordAiRequest` in
 *      `metrics.ts`), timed over the provider request itself and composed into
 *      the Effect so the observation writes the process-global `Metric` registry
 *      the OtlpMetrics poller snapshots — independent of whether tracing is armed.
 *
 * The duration + count are observed on the SUCCESS path (a completed request); a
 * failed request still produces the `ai.request` span (marked errored by
 * `withSpan`) but no metric datapoint.
 */

import { Duration, Effect } from 'effect'
import { recordAiRequest } from './metrics'

/**
 * Wrap an AI provider-call Effect with the AI service-layer seam: an
 * `ai.request` child span + `ai.request.duration`/`ai.request.count`
 * observations, all labeled `{ provider, model, operation }`. Preserves the
 * request's success/error/requirement types.
 */
export const traceAiRequest = <A, E, R>(
  provider: string,
  model: string,
  operation: string,
  request: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.timed(request).pipe(
    Effect.tap(([elapsed]) =>
      recordAiRequest(provider, model, operation, Duration.toMillis(elapsed) / 1000)
    ),
    Effect.map(([, result]) => result),
    Effect.withSpan('ai.request', { attributes: { provider, model, operation } })
  )
