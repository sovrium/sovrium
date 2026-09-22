/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `Tracer` that files every span it mints into the current request's box
 * (`request-trace-context.ts`) and otherwise behaves exactly like the tracer it
 * wraps.
 *
 * This is the producer half of the span seam. Effect's ended spans all
 * disappear into the OTLP exporter's module-private buffer in `node_modules`,
 * so the only place Sovrium can observe a span is at the moment the tracer
 * creates it. `collectingTracer` sits at that one seam.
 *
 * ## It must work WITHOUT a delegate
 *
 * Span collection is gated on the SENTRY configuration, while the OTLP delegate
 * is gated on a traces endpoint that may well be unset — which is exactly the
 * current production configuration. So the delegate is optional, and with none
 * supplied this tracer constructs `Tracer.NativeSpan` directly, reproducing the
 * behaviour of the default tracer `Tracer.Tracer` would have used anyway.
 *
 * ## Never wrap the span
 *
 * `span()` returns the delegate's own object, unchanged and unproxied. This is
 * the single most important constraint in this file. `OtlpTracer` builds its
 * spans against a shared `SpanProto` and calls `end()` through it; a `Proxy` or
 * a hand-rolled shim breaks that dispatch, and the failure is silent — spans
 * simply stop being exported. Returning the same object identity is also what
 * lets the box observe finished spans at all, since `end()` mutates the span in
 * place (see `request-trace-context.ts`).
 *
 * `Tracer.make` and `Tracer.NativeSpan` are public, documented `effect/Tracer`
 * API. Nothing here reaches into `OtlpExporter`'s internals: there is no seam
 * there, and it is `node_modules` code.
 */

import { Tracer } from 'effect'
import { recordSpan } from './request-trace-context'

/**
 * Build a tracer that records every span it creates into the current request's
 * box, then returns that span untouched.
 *
 * @param delegate - the tracer to mint spans with, typically the OTLP tracer.
 *   When omitted, native spans are constructed directly.
 */
export const collectingTracer = (delegate?: Tracer.Tracer): Tracer.Tracer =>
  Tracer.make({
    span(options) {
      const span = delegate === undefined ? new Tracer.NativeSpan(options) : delegate.span(options)
      // The collection side effect this tracer exists for.
      recordSpan(span)
      // Returned as-is: no Proxy, no shim. See the module docstring.
      return span
    },
    // Forwarded verbatim. `OtlpTracer` uses `context` to evaluate primitives
    // against the fiber's current span; dropping it would silently disable that
    // for every request. It is a closure over the delegate's own options and
    // does not depend on `this`, so passing the reference is safe.
    context: delegate?.context,
  })
