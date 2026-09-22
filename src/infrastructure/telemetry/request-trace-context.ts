/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Per-request span-collection seam (`AsyncLocalStorage` + traceId index).
 *
 * Effect already mints a real span for every `withSpan` on the request path —
 * `Tracer.Tracer` is a `Context.Reference` whose `defaultValue` builds a native
 * tracer returning `NativeSpan`s, so tracing is never a no-op. The problem is
 * REACHABILITY, not creation: every span Effect ends is handed to the OTLP
 * exporter's module-private batch buffer inside `node_modules`, which Sovrium
 * code cannot read. The Sentry transaction envelope
 * (`telemetry/sentry-envelope.ts`) — the one payload that actually reaches the
 * backend — has therefore never been able to carry a span breakdown.
 *
 * This module is the missing box: {@link withRequestTrace} opens one per
 * request, {@link recordSpan} files each created span into the right one, and
 * the envelope builder reads the box at response time. It touches neither the
 * exporter nor the spans themselves.
 *
 * ## Why `AsyncLocalStorage` and not an Effect primitive
 *
 * The same reason `db-query-counter.ts` uses it, and that file's docstring is
 * the long form: Effect v4 has no `FiberRef`, and `Context.Reference` memoizes
 * its `defaultValue()` onto the reference object itself — one box shared
 * process-wide. ALS is the only mechanism that spans a plain Hono callback
 * frame and the Effect fiber steps scheduled beneath it.
 *
 * ## Attribution is TWO-KEY, deliberately
 *
 * Do not collapse these two paths into one; the split is the whole design.
 *
 * - **The ROOT is bound via ALS.** It is created in the first fiber step inside
 *   the Hono handler frame, where `AsyncLocalStorage.getStore()` is
 *   unambiguous. Binding it also registers `traceId -> box` in
 *   {@link traceIdIndex}.
 * - **Every CHILD is attributed by `traceId`**, looked up in that index, with
 *   NO ALS read at all. Effect derives a child's `traceId` from its parent
 *   chain, so this is correct regardless of how the fiber scheduler
 *   interleaves work.
 *
 * That second point matters more than it looks. `db-query-counter.ts`'s
 * concurrency verification covers a SYNCHRONOUS Drizzle callback; it says
 * nothing about arbitrary fiber yields inside
 * `Effect.all({ concurrency: 'unbounded' })`. Keying children on `traceId`
 * makes their attribution scheduler-independent BY CONSTRUCTION rather than by
 * testing.
 *
 * ## Spans are collected at CREATION, read after they END
 *
 * `recordSpan` runs when the tracer mints the span, before any work happens.
 * That is fine — and in fact required — because a `Tracer.Span` is a mutable
 * object whose `end()` rewrites its own `status` to `Ended` in place. The box
 * holds the same object identity the runtime is still mutating, so reading the
 * box at response time yields FINISHED spans. This is exactly why
 * `span-collector.ts` must never wrap a span in a Proxy or shim.
 *
 * ## Known limitations (deliberate)
 *
 * - A span created with `root: true` inside a request gets a fresh `traceId`
 *   that is in neither the index nor the box, and is dropped. It belongs to a
 *   different trace than the request transaction, so that is correct.
 * - Two live requests sharing one `traceId` (inbound trace propagation) share
 *   one index slot; the later root wins, and the earlier request's children
 *   land in the later box. Cleanup is identity-guarded so the loser never
 *   evicts the winner's entry.
 * - Spans that end AFTER the response was snapshotted are in the box but not in
 *   the envelope; the envelope reports the trace as of response time.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import type { Tracer } from 'effect'

/**
 * Per-request sampling decision, taken once by the caller before the box is
 * opened. The two flags are independent: `sampled` is Effect's span-level
 * export decision, while `emitTransaction` is the Sentry performance-sampling
 * roll (`Math.random() < SENTRY_TRACES_SAMPLE_RATE`, minus static assets — see
 * `performance-middleware.ts`). A request can be span-sampled without being
 * chosen for a transaction envelope, and vice versa.
 */
export interface RequestTraceDecision {
  readonly sampled: boolean
  readonly emitTransaction: boolean
}

/**
 * Mutable per-request span box. Mutation is the point of this seam: the box is
 * appended to from tracer callbacks that have no other channel back to the
 * request.
 *
 * `root` is held separately from `spans` because the Sentry transaction
 * envelope is shaped that way — the root IS the transaction, and `spans[]` is
 * its child breakdown. Keeping them apart avoids emitting the root twice.
 */
export interface RequestTraceBox {
  readonly sampled: boolean
  readonly emitTransaction: boolean
  root: Tracer.Span | undefined
  readonly spans: Array<Tracer.Span>
  dropped: number
}

/**
 * Maximum number of CHILD spans retained per request, matching GlitchTip's
 * server-side `MAX_SPANS_PER_TRANSACTION`. Collecting past the point the
 * backend will accept only costs memory, so overflow increments `dropped` and
 * the array stops growing.
 */
export const MAX_COLLECTED_SPANS = 1000

const storage = new AsyncLocalStorage<RequestTraceBox>()

/**
 * `traceId -> box` for the currently-open requests. This is what makes child
 * attribution scheduler-independent: a child span carries its parent's
 * `traceId`, so it finds its box without ever consulting ALS.
 */
const traceIdIndex = new Map<string, RequestTraceBox>()

/**
 * The span box of the current request, or `undefined` outside one (boot, cron,
 * background listeners). Read by the envelope builder to snapshot the trace.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- callers receive the live, mutable box on purpose: it keeps filling while the request runs
export const currentRequestTrace = (): RequestTraceBox | undefined => storage.getStore()

/** Append one child span to a box, or count it as dropped past the cap. */
// eslint-disable-next-line functional/prefer-immutable-types -- the box is deliberately mutable; appending to it is this seam's entire purpose
const collectChild = (box: RequestTraceBox, span: Tracer.Span): void => {
  if (box.spans.length >= MAX_COLLECTED_SPANS) {
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- sanctioned mutation: overflow counter on the request-scoped box
    box.dropped += 1
    return
  }
  // eslint-disable-next-line functional/immutable-data, no-restricted-syntax, functional/no-expression-statements -- sanctioned mutation: O(1) append; rebuilding the array per span is O(n^2) over a 1000-span request
  box.spans.push(span)
}

/**
 * Attribute one freshly-created span to the right request box.
 *
 * A no-op outside a traced request — `getStore()` returns `undefined` and the
 * `traceId` is unknown — so the collector never leaks across requests nor
 * invents a request context for boot, cron, or listener spans.
 *
 * The first span seen inside a box becomes its ROOT and registers the box under
 * its `traceId`; every later span of that trace is attributed by `traceId`
 * alone.
 */
export const recordSpan = (span: Tracer.Span): void => {
  const indexed = traceIdIndex.get(span.traceId)
  if (indexed !== undefined) {
    // Child (or any later span) of a trace we already own: attributed purely by
    // traceId, with no ALS read, so fiber interleaving cannot misfile it.
    return collectChild(indexed, span)
  }

  const box = storage.getStore()
  if (box === undefined || box.root !== undefined) {
    // No open box, or this is a foreign trace (e.g. a `root: true` span) opened
    // inside a request that already has its root. Neither belongs to us.
    return
  }

  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- sanctioned mutation: binding the request root, once
  box.root = span
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- sanctioned mutation: registering the box makes every descendant attributable by traceId
  traceIdIndex.set(span.traceId, box)
}

/**
 * Run `body` under a fresh span box and return its value together with the box.
 *
 * The index entry is removed in a `finally` on BOTH the normal and the throwing
 * path: a handler that throws would otherwise leak its map entry forever, and
 * that leak is unbounded in request count. The removal is identity-guarded so a
 * request whose `traceId` was later re-registered by another request cannot
 * evict the newer owner's entry.
 */
export const withRequestTrace = async <A>(
  decision: RequestTraceDecision,
  body: () => Promise<A>
): Promise<{ readonly value: A; readonly trace: RequestTraceBox }> => {
  // eslint-disable-next-line functional/prefer-immutable-types -- the box exists to be appended to from tracer callbacks outside this frame
  const box: RequestTraceBox = {
    sampled: decision.sampled,
    emitTransaction: decision.emitTransaction,
    root: undefined,
    spans: [],
    dropped: 0,
  }
  try {
    const value = await storage.run(box, body)
    return { value, trace: box }
  } finally {
    const traceId = box.root?.traceId
    if (traceId !== undefined && traceIdIndex.get(traceId) === box) {
      // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, drizzle/enforce-delete-with-where -- sanctioned mutation: Map#delete, not a Drizzle query; releasing the index slot, whose leak would grow unboundedly
      traceIdIndex.delete(traceId)
    }
  }
}
