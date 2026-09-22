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
 * The OTLP unit is carried as a constant `unit` ATTRIBUTE: the metrics exporter
 * reads the instrument's UCUM unit from a `unit`/`time_unit` attribute (this is
 * how `Metric.timer` surfaces `time_unit` too). Verified unchanged in v4 —
 * `effect/unstable/observability/OtlpMetrics.js:78` still reads
 * `attributes?.unit ?? attributes?.time_unit ?? "1"`, so the mechanism that
 * gives every instrument below its unit survives the rename intact.
 *
 * EFFECT 4. `MetricBoundaries` and `MetricLabel` are gone as modules. Histogram
 * boundaries are a plain `ReadonlyArray<number>` inside the options object
 * (Metric.d.ts:2175), and labels are a plain attribute record
 * (`Metric.withAttributes`) rather than constructed `MetricLabel` values.
 */

import { Effect, Metric } from 'effect'

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
}).pipe(Metric.withAttributes({ unit: '{request}' }))

/** Request-duration histogram — OTLP `histogram`, unit `s`. */
const httpRequestDuration = Metric.histogram('http.server.request.duration', {
  description: 'Duration of HTTP server requests in seconds.',
  boundaries: DURATION_BOUNDARIES_SECONDS,
}).pipe(Metric.withAttributes({ unit: 's' }))

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
  const attributes = { method, route, status }
  return Effect.andThen(
    Metric.update(httpRequestCount.pipe(Metric.withAttributes(attributes)), 1),
    Metric.update(httpRequestDuration.pipe(Metric.withAttributes(attributes)), durationSeconds)
  )
}

/**
 * DB-query duration histogram — OTLP `histogram`, unit `s`. Shares the HTTP
 * duration bucket boundaries: query latencies span the same millisecond-to-
 * seconds range as request latencies.
 */
const dbQueryDuration = Metric.histogram('db.query.duration', {
  description: 'Duration of database queries in seconds.',
  boundaries: DURATION_BOUNDARIES_SECONDS,
}).pipe(Metric.withAttributes({ unit: 's' }))

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
  const attributes = { operation, table }
  return Metric.update(dbQueryDuration.pipe(Metric.withAttributes(attributes)), durationSeconds)
}

/**
 * Per-request DB query-count histogram boundaries. Counts, not seconds: the
 * interesting resolution is "0 / a handful / tens / hundreds" — the N+1 shapes
 * a performance gate wants to see — so the buckets widen geometrically.
 */
const DB_QUERIES_PER_REQUEST_BOUNDARIES = [0, 1, 2, 5, 10, 20, 50, 100, 200, 500] as const

/**
 * Per-request DB query-count histogram — OTLP `histogram`, unit `{query}`.
 * One observation per served HTTP request: the number of SQL statements issued
 * while serving it, as counted by the per-request query-count seam
 * (`db-query-counter.ts` + the Drizzle `countingLogger` in `db-bun.ts`).
 */
const dbQueriesPerRequest = Metric.histogram('db.query.per_request', {
  description: 'Number of database queries issued while serving one HTTP request.',
  boundaries: DB_QUERIES_PER_REQUEST_BOUNDARIES,
}).pipe(Metric.withAttributes({ unit: '{query}' }))

/**
 * Build the effect that observes ONE served request's DB query count on the
 * `db.query.per_request` histogram. No labels: the request's `{ method, route,
 * status }` breakdown already lives on the HTTP instruments, and the count is
 * correlated per-trace via the root span's `db.query.count` attribute — a
 * label set here would only multiply cardinality. Recorded UNCONDITIONALLY by
 * the `db-query-count-header` middleware (only the response HEADER is
 * env-gated). The returned effect writes the process-global registry
 * synchronously — run it via `emitMetric` on the observability runtime.
 */
export const recordDbQueriesPerRequest = (count: number): Effect.Effect<void> =>
  Metric.update(dbQueriesPerRequest, count)

/** Monotonic AI-request counter — OTLP `sum`, unit `{request}`. */
const aiRequestCount = Metric.counter('ai.request.count', {
  description: 'Number of AI provider requests issued.',
  incremental: true,
}).pipe(Metric.withAttributes({ unit: '{request}' }))

/**
 * AI-request duration histogram — OTLP `histogram`, unit `s`. Shares the HTTP
 * duration bucket boundaries: provider latencies span the same millisecond-to-
 * seconds range.
 */
const aiRequestDuration = Metric.histogram('ai.request.duration', {
  description: 'Duration of AI provider requests in seconds.',
  boundaries: DURATION_BOUNDARIES_SECONDS,
}).pipe(Metric.withAttributes({ unit: 's' }))

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
  const attributes = { provider, model, operation }
  return Effect.andThen(
    Metric.update(aiRequestCount.pipe(Metric.withAttributes(attributes)), 1),
    Metric.update(aiRequestDuration.pipe(Metric.withAttributes(attributes)), durationSeconds)
  )
}

/** Monotonic automation-run counter — OTLP `sum`, unit `{run}`. */
const automationRunCount = Metric.counter('automation.run.count', {
  description: 'Number of automation runs executed.',
  incremental: true,
}).pipe(Metric.withAttributes({ unit: '{run}' }))

/**
 * Automation-run duration histogram — OTLP `histogram`, unit `s`. Shares the
 * HTTP duration bucket boundaries.
 */
const automationRunDuration = Metric.histogram('automation.run.duration', {
  description: 'Duration of automation runs in seconds.',
  boundaries: DURATION_BOUNDARIES_SECONDS,
}).pipe(Metric.withAttributes({ unit: 's' }))

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
  const durationAttributes = { automation }
  const countAttributes = { automation, status }
  return Effect.andThen(
    Metric.update(automationRunCount.pipe(Metric.withAttributes(countAttributes)), 1),
    Metric.update(
      automationRunDuration.pipe(Metric.withAttributes(durationAttributes)),
      durationSeconds
    )
  )
}
