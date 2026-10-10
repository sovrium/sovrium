/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The receiver never reports itself: the request-scoped INGEST flag.
 *
 * An app may send its own errors and transactions to its own telemetry
 * receiver (a webhook trigger declaring a `protocol`). Without care that loops
 * for ever: serving an ingest request emits a transaction, which is ingested,
 * which emits a transaction — the G1 spike measured one envelope becoming about
 * 65 runs a second, indefinitely. A path check cannot stop it once the paths
 * are configurable, so the protocol route MARKS what it serves, and every
 * reporter asks the mark:
 *
 * - {@link markIngestRequest} / {@link isIngestRequest}: the HTTP request
 *   itself, keyed by the raw `Request` (it lives exactly as long as the
 *   request, so nothing needs clearing). Read by the trace middleware (no
 *   transaction), the server's `.onError` (no report) and the per-address
 *   API ceiling (ingest has its own per-project budget).
 * - {@link runInIngestScope} / {@link isInIngestScope}: the async context of
 *   the work done while serving it. A `logError` with a cause raised anywhere
 *   beneath the handler — a repository, the error sanitizer — has no request
 *   at hand, so `emitTelemetryLog` reads this instead and writes the line to
 *   the server log without reporting it.
 * - {@link outsideIngestScope}: the automations an ingest request starts run
 *   AFTER the answer and are ordinary runs; their failures are reported like
 *   any run's, so they are dispatched outside the scope.
 */

import { AsyncLocalStorage } from 'node:async_hooks'

const ingestRequests = new WeakSet<Request>()

const ingestScope = new AsyncLocalStorage<true>()

/** Mark a request as served by a telemetry protocol route. */
export const markIngestRequest = (request: Request): void => {
  ingestRequests.add(request)
}

/** Whether a request is served by a telemetry protocol route. */
export const isIngestRequest = (request: Request): boolean => ingestRequests.has(request)

/** Run `body` inside the ingest scope: nothing it logs is reported. */
export const runInIngestScope = <A>(body: () => A): A => ingestScope.run(true, body)

/** Run `body` outside any ingest scope: what it fails with is reported as usual. */
export const outsideIngestScope = <A>(body: () => A): A => ingestScope.exit(body)

/** Whether the current async context is serving an ingest request. */
export const isInIngestScope = (): boolean => ingestScope.getStore() === true
