/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Server metric instruments.
 *
 * HTTP-server edge (2 instruments):
 *
 * 1. `http.server.request.count`   — a monotonic COUNTER (OTLP `sum`), unit
 *    `{request}`, one increment per served request.
 * 2. `http.server.request.duration` — a HISTOGRAM, unit `s`, one observation of
 *    the request's wall-clock duration (seconds) per served request.
 *
 * Both are tagged per request with `{ method, route, status }`. The `route` is
 * the TEMPLATED Hono route pattern (`/`, `/api/tables/:slug`, …) — NEVER the raw
 * URL — so the label set stays bounded; `status` is the numeric response code as
 * a string.
 *
 * DB access seam (1 instrument):
 *
 * 3. `db.query.duration` — a HISTOGRAM, unit `s`, one observation of a table
 *    read/write's wall-clock duration (seconds), tagged `{ operation, table }`
 *    where `operation` is the SQL verb (`select`/`insert`/`update`/`delete`)
 *    and `table` is the LOGICAL table name — both bounded, config-derived
 *    labels (never raw SQL / ids). Recorded at the shared record DB seam (the
 *    crud read/write functions) alongside the `db.query` child span; see
 *    `db-query-trace.ts`.
 *
 * AI request seam (2 instruments):
 *
 * 4. `ai.request.count`    — a monotonic COUNTER (OTLP `sum`), unit
 *    `{request}`, one increment per completed AI provider request.
 * 5. `ai.request.duration` — a HISTOGRAM, unit `s`, one observation of an AI
 *    provider request's wall-clock duration (seconds).
 *
 * Both are tagged `{ provider, model, operation }` — all bounded, config-derived
 * (the resolved AI provider, the request's model, and the AI operation, e.g.
 * `chat`) — never prompt text / message content / user ids / keys. Recorded at
 * the shared `AiService.chat` seam (`ai-service-live.ts`) alongside the
 * `ai.request` child span; see `ai-request-trace.ts`.
 *
 * Automation run seam (2 instruments):
 *
 * 6. `automation.run.count`    — a monotonic COUNTER (OTLP `sum`), unit
 *    `{run}`, one increment per completed automation run, tagged
 *    `{ automation, status }` (the definition name + terminal run status).
 * 7. `automation.run.duration` — a HISTOGRAM, unit `s`, one observation of a
 *    run's wall-clock duration (seconds), tagged `{ automation }` only.
 *
 * Both labels are bounded, config-derived (never trigger payload / run ids /
 * step output). Recorded at the shared `executeAutomationRun` run-loop seam
 * (`run-automation.ts`) alongside the `automation.run` child span; see
 * `automation-run-trace.ts`.
 *
 * Effect metrics write the process-global `Metric` registry, which the
 * `OtlpMetrics` periodic reader snapshots each poll — so an update run on ANY
 * runtime reaches the exporter regardless of fiber (see observability-runtime).
 *
 * The OTLP unit is carried as a constant `unit` tag: the `@effect/opentelemetry`
 * metrics exporter reads the instrument's UCUM unit from a `unit`/`time_unit`
 * tag (this is how `Metric.timer` surfaces `time_unit` too).
 */

import { Effect, Metric, MetricBoundaries, MetricLabel } from 'effect'

/**
 * Request-duration histogram boundaries, in SECONDS — the OpenTelemetry
 * semantic-convention default bucket set for `http.server.request.duration`.
 */
const DURATION_BOUNDARIES_SECONDS = [
  0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10,
] as const

/** Monotonic request counter — OTLP `sum`, unit `{request}`. */
const httpRequestCount = Metric.counter('http.server.request.count', {
  description: 'Number of HTTP server requests handled.',
  incremental: true,
}).pipe(Metric.tagged('unit', '{request}'))

/** Request-duration histogram — OTLP `histogram`, unit `s`. */
const httpRequestDuration = Metric.histogram(
  'http.server.request.duration',
  MetricBoundaries.fromIterable(DURATION_BOUNDARIES_SECONDS),
  'Duration of HTTP server requests in seconds.'
).pipe(Metric.tagged('unit', 's'))

/**
 * Build the effect that records ONE served HTTP request: increment the request
 * counter AND observe its duration on the histogram, both under the same
 * `{ method, route, status }` label set. `route` MUST be the templated route
 * pattern (never a raw path); `status` is the numeric code as a string. The
 * returned effect writes the global registry synchronously — run it via
 * `emitMetric` on the observability runtime.
 */
export const recordHttpRequest = (
  method: string,
  route: string,
  status: string,
  durationSeconds: number
): Effect.Effect<void> => {
  const labels = [
    MetricLabel.make('method', method),
    MetricLabel.make('route', route),
    MetricLabel.make('status', status),
  ]
  return Effect.zipRight(
    Metric.update(httpRequestCount.pipe(Metric.taggedWithLabels(labels)), 1),
    Metric.update(httpRequestDuration.pipe(Metric.taggedWithLabels(labels)), durationSeconds)
  )
}

/**
 * DB-query duration histogram — OTLP `histogram`, unit `s`. Shares the HTTP
 * duration bucket boundaries: query latencies span the same millisecond-to-
 * seconds range as request latencies.
 */
const dbQueryDuration = Metric.histogram(
  'db.query.duration',
  MetricBoundaries.fromIterable(DURATION_BOUNDARIES_SECONDS),
  'Duration of database queries in seconds.'
).pipe(Metric.tagged('unit', 's'))

/**
 * Build the effect that observes ONE table read/write's duration on the
 * `db.query.duration` histogram, tagged `{ operation, table }`. `operation` is
 * the SQL verb (`select`/`insert`/`update`/`delete`); `table` is the LOGICAL
 * table name — both bounded, config-derived (never raw SQL / ids). The returned
 * effect writes the process-global registry synchronously; compose it into the
 * DB seam's Effect (see `traceDbQuery`) so the observation runs on the same
 * observability runtime whose poller snapshots the registry.
 */
export const recordDbQuery = (
  operation: string,
  table: string,
  durationSeconds: number
): Effect.Effect<void> => {
  const labels = [MetricLabel.make('operation', operation), MetricLabel.make('table', table)]
  return Metric.update(dbQueryDuration.pipe(Metric.taggedWithLabels(labels)), durationSeconds)
}

/** Monotonic AI-request counter — OTLP `sum`, unit `{request}`. */
const aiRequestCount = Metric.counter('ai.request.count', {
  description: 'Number of AI provider requests issued.',
  incremental: true,
}).pipe(Metric.tagged('unit', '{request}'))

/**
 * AI-request duration histogram — OTLP `histogram`, unit `s`. Shares the HTTP
 * duration bucket boundaries: provider latencies span the same millisecond-to-
 * seconds range.
 */
const aiRequestDuration = Metric.histogram(
  'ai.request.duration',
  MetricBoundaries.fromIterable(DURATION_BOUNDARIES_SECONDS),
  'Duration of AI provider requests in seconds.'
).pipe(Metric.tagged('unit', 's'))

/**
 * Build the effect that records ONE completed AI provider request: increment
 * the request counter AND observe its duration, both under the same
 * `{ provider, model, operation }` label set (the resolved provider, the
 * request's model, and the AI operation — never prompt text / user ids / keys).
 * The returned effect writes the process-global registry synchronously; compose
 * it into the AI seam's Effect (see `traceAiRequest`) so the observation runs on
 * the same observability runtime whose poller snapshots the registry.
 */
export const recordAiRequest = (
  provider: string,
  model: string,
  operation: string,
  durationSeconds: number
): Effect.Effect<void> => {
  const labels = [
    MetricLabel.make('provider', provider),
    MetricLabel.make('model', model),
    MetricLabel.make('operation', operation),
  ]
  return Effect.zipRight(
    Metric.update(aiRequestCount.pipe(Metric.taggedWithLabels(labels)), 1),
    Metric.update(aiRequestDuration.pipe(Metric.taggedWithLabels(labels)), durationSeconds)
  )
}

/** Monotonic automation-run counter — OTLP `sum`, unit `{run}`. */
const automationRunCount = Metric.counter('automation.run.count', {
  description: 'Number of automation runs executed.',
  incremental: true,
}).pipe(Metric.tagged('unit', '{run}'))

/**
 * Automation-run duration histogram — OTLP `histogram`, unit `s`. Shares the
 * HTTP duration bucket boundaries.
 */
const automationRunDuration = Metric.histogram(
  'automation.run.duration',
  MetricBoundaries.fromIterable(DURATION_BOUNDARIES_SECONDS),
  'Duration of automation runs in seconds.'
).pipe(Metric.tagged('unit', 's'))

/**
 * Build the effect that records ONE completed automation run: increment the run
 * counter (tagged `{ automation, status }`) AND observe its duration (tagged
 * `{ automation }` only), where `automation` is the definition name and
 * `status` the terminal run status — both bounded, config-derived (never
 * trigger payload / run ids / step output). The returned effect writes the
 * process-global registry synchronously; compose it into the run-loop seam's
 * Effect (see `traceAutomationRun`) so the observation runs on the same
 * observability runtime whose poller snapshots the registry.
 */
export const recordAutomationRun = (
  automation: string,
  status: string,
  durationSeconds: number
): Effect.Effect<void> => {
  const durationLabels = [MetricLabel.make('automation', automation)]
  const countLabels = [
    MetricLabel.make('automation', automation),
    MetricLabel.make('status', status),
  ]
  return Effect.zipRight(
    Metric.update(automationRunCount.pipe(Metric.taggedWithLabels(countLabels)), 1),
    Metric.update(
      automationRunDuration.pipe(Metric.taggedWithLabels(durationLabels)),
      durationSeconds
    )
  )
}
