/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * DB access-layer seam instrumentation.
 *
 * `traceDbQuery` is the ONE wrapper the shared record DB functions
 * (`listRecords` / `getRecord` / the CRUD writers) apply to their query Effect.
 * It emits BOTH signals for a single table read/write, from the point where the
 * LOGICAL table name + SQL verb are known (never raw SQL / ids — cardinality):
 *
 *   1. a `db.query` CHILD span carrying `{ operation, table }` attributes. Being
 *      an `Effect.withSpan`, it chains under whatever span is current on the
 *      running fiber — so when the request runs through `runRequestEffect` (the
 *      request-edge root `http.server` span), the DB span chains under the
 *      request root, giving free request↔query correlation. Off-request DB calls
 *      still CREATE the span: `Tracer.Tracer` is a `Context.Reference` whose
 *      `defaultValue` is a NATIVE tracer minting real `NativeSpan`s
 *      (`effect/Tracer.js`), so `withSpan` is never a no-op — with no collector
 *      listening it is one in-memory allocation, dropped unreferenced.
 *   2. a `db.query.duration` HISTOGRAM observation labeled `{ operation, table }`
 *      (see `recordDbQuery` in `metrics.ts`), timed over the query itself and
 *      composed into the Effect so the observation writes the process-global
 *      `Metric` registry the OtlpMetrics poller snapshots — independent of
 *      whether tracing is armed.
 *
 * The duration is observed on the SUCCESS path (a completed query); a failed
 * query still produces the `db.query` span (marked errored by `withSpan`) but no
 * latency datapoint.
 */

import { Duration, Effect } from 'effect'
import { recordDbQuery } from './metrics'

/** The SQL verb carried as the `operation` span attribute / metric label. */
export type DbOperation = 'select' | 'insert' | 'update' | 'delete'

/**
 * Wrap a table read/write query Effect with the DB access-layer seam: a
 * `db.query` child span + a `db.query.duration` observation, both labeled
 * `{ operation, table }`. Preserves the query's success/error/requirement types.
 */
export const traceDbQuery = <A, E, R>(
  operation: DbOperation,
  table: string,
  query: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.timed(query).pipe(
    Effect.tap(([elapsed]) => recordDbQuery(operation, table, Duration.toMillis(elapsed) / 1000)),
    Effect.map(([, result]) => result),
    Effect.withSpan('db.query', { attributes: { operation, table } })
  )
