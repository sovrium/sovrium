/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Request-edge tracing wrapper.
 *
 * Runs a request's Effect program on the unified observability runtime, wrapped
 * in a ROOT `http.server <METHOD> <route>` span so that:
 *
 *  1. any `Effect.withSpan` CHILD seams inside the program (page/SSR render, and
 *     later the DB/automation/AI seams) chain under the request root, and
 *  2. a structured request log is emitted INSIDE the root span — `OtlpLogger`
 *     stamps the span's `traceId` onto it, giving free log↔trace correlation
 *     (the correlation that was missing in GlitchTip).
 *
 * `route` is the TEMPLATED route pattern (`c.req.routePath` — `/`, `/api/tables/:slug`),
 * never the concrete URL, matching the metrics story's `route`-label cardinality
 * discipline.
 *
 * Head-sampling — the ecoconception volume lever — is applied HERE, once per
 * request: when traces are armed but this request is not sampled, the whole
 * traced region runs under `Effect.withTracerEnabled(false)` so NO spans (root or
 * child) are created or exported. When traces are off entirely, spans are STILL
 * created: `Tracer.Tracer` is a `Context.Reference` whose `defaultValue` is a
 * NATIVE tracer minting real `NativeSpan`s (`effect/Tracer.js`), so
 * `Effect.withSpan` is never a no-op. That is load-bearing rather than wasteful
 * — it is exactly what lets the Sentry transaction path collect a request's
 * spans with the OTLP trace pipeline disarmed (the production configuration).
 *
 * WHAT THIS WRAPPER IS NOT. It is not where a program's SERVICES come from. It
 * takes an `Effect<A, E, never>` — a program whose requirements are already
 * discharged — and it runs it on the OBSERVABILITY runtime, because that is the
 * runtime carrying the tracer and the log sinks. A program that needs domain
 * services is discharged first, by `provideDomain` (`./domain-runtime`), from
 * the context the server's own `ManagedRuntime` resolved at boot:
 *
 * ```ts
 * await runRequestEffect(c, provideDomain(c, program).pipe(Effect.result))
 * ```
 *
 * Two runtimes, and the split is deliberate rather than transitional. The
 * telemetry runtime must exist during the BOOT WINDOW, before any domain layer
 * does; the domain runtime must be owned by the `ServerInstance`, because a
 * process boots many servers under `serverMode: 'inprocess'`. Composing a
 * resolved `Context` into a program is what lets one program satisfy both: the
 * services come from the server, the span and the log correlation come from the
 * telemetry runtime, and nothing is rebuilt per request — a `Context` is the
 * built result, not a recipe.
 *
 * This wrapper is the house pattern for the request edge; what W3 changed is
 * what is provided to it. Fifteen of the nineteen per-folder `effect-runner.ts`
 * files have retired with their last caller, and `provideDomain` is the only
 * shape a NEW handler should reach for.
 *
 * FOUR runners remain, each for a reason that is not "not done yet" — read the
 * header of the one you are looking at before assuming otherwise:
 * `routes/ai/`, `routes/automations/` and `routes/forms/` compose `AiService`,
 * whose layer probes Ollama over the network while it is being built, so
 * merging them into `createAppLayer` would put that round trip on the boot
 * path; `routes/agents/` serves the cron scheduler, which has no request to
 * take a context from.
 */

import { Effect } from 'effect'
import { currentDbQueryCount } from '@/infrastructure/telemetry/db-query-counter'
import { runRequest } from '@/infrastructure/telemetry/observability-runtime'
import { currentRequestTrace } from '@/infrastructure/telemetry/request-trace-context'
import { getTelemetryConfig } from '@/infrastructure/telemetry/telemetry-config'
import type { Tracer } from 'effect'
import type { Context } from 'hono'

/**
 * Head-sampling decision for one request from the effective ratio in `[0,1]`.
 *
 * Used ONLY when there is no request box to read the decision off — the static
 * build, `createHonoAppForSSG`, and the unit harnesses all call
 * `runRequestEffect` outside any HTTP middleware. Inside a real request the
 * draw was already taken once, in `performance-middleware.ts`, and rolling
 * again here would give one request two different answers to "am I sampled?".
 */
const decideSampled = (ratio: number): boolean => {
  if (ratio >= 1) return true
  if (ratio <= 0) return false
  return Math.random() < ratio
}

/**
 * Run `program` on the observability runtime under a root `http.server` span.
 * Returns the program's success value; failures/defects propagate as a rejected
 * Promise (the page route's existing `try/catch` maps them to a 500), preserving
 * today's request-handling behavior.
 *
 * `program` must already require nothing, which is the only kind of program a
 * runtime can execute. There is no escape hatch, and that is the point: this
 * used to accept any program plus an OPTIONAL discharge function, and the arm
 * where the function was omitted read `program as Effect<A, E, never>` — so a
 * program with unmet requirements typechecked exactly like one without, and the
 * difference only showed up as a missing-service defect at request time. No
 * caller ever passed the optional discharge, so removing it costs nothing and
 * turns that class of mistake into a compile error. A caller that needs a
 * service provides it before handing the program over.
 */
export async function runRequestEffect<A, E = never>(
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is inherently mutable
  c: Context,
  provided: Effect.Effect<A, E, never>
): Promise<A> {
  const { method } = c.req
  const route = c.req.routePath
  const requestId = (c.get('requestId') as string | undefined) ?? ''

  // The in-span request log: emitted while the root span is current, so
  // OtlpLogger correlates it to the trace. Debug level matches the existing
  // access-log discipline (LOG_LEVEL=debug surfaces it; higher levels drop it).
  const requestLog =
    requestId === ''
      ? Effect.logDebug(`${method} ${route}`)
      : Effect.logDebug(`${method} ${route}`).pipe(Effect.annotateLogs({ 'request.id': requestId }))

  const annotated = requestLog.pipe(
    Effect.andThen(provided),
    // Stamp the per-request DB query count onto the root span AT PROGRAM
    // COMPLETION (an attribute in `withSpan`'s options would be evaluated at
    // span creation, when the count is still 0). `currentDbQueryCount()` reads
    // the AsyncLocalStorage box the db-query-count middleware opened around
    // this request — the fiber runs inside it, so the read is request-scoped.
    // Runs on the success path only: a failed program skips the annotation,
    // matching how the failure path also skips the response header.
    Effect.tap(() => Effect.annotateCurrentSpan('db.query.count', currentDbQueryCount()))
  )

  const box = currentRequestTrace()
  const rooted = rootOrAdopt(annotated, box?.root, { method, route, requestId })

  return runRequest(applyHeadSampling(rooted, box?.sampled))
}

/**
 * Disable span creation for a request the head sampler did not pick.
 *
 * Only meaningful when traces are armed: with the OTLP pipeline off there is no
 * exporter to spare, and the spans that are still created are what the Sentry
 * transaction reads. Inside a request the decision was already taken — once, in
 * `performance-middleware.ts` — and is read off the box, so the transaction and
 * the exported spans agree about whether the request was sampled instead of
 * each rolling its own dice. Outside a request there is no box, so we draw.
 */
const applyHeadSampling = <A, E>(
  program: Effect.Effect<A, E, never>,
  boxSampled: boolean | undefined
): Effect.Effect<A, E, never> => {
  const { traces } = getTelemetryConfig()
  if (traces === undefined) return program
  const sampled = boxSampled ?? decideSampled(traces.sampleRatio)
  return sampled ? program : Effect.withTracerEnabled(program, false)
}

/** The templated identity a request root span is named and labelled with. */
interface RequestSpanIdentity {
  readonly method: string
  readonly route: string
  readonly requestId: string
}

/**
 * Open a root `http.server` span, or CHAIN under the request's existing root.
 *
 * A handler may call `runRequestEffect` several times for ONE request —
 * `forms.ts` runs three programs in sequence on the happy path — and opening a
 * fresh root each time fragments a single submission into three disconnected
 * traces, with the `db.query` children hanging under whichever fragment
 * happened to issue them. Only the first call of a request creates a root;
 * outside a request (SSG, unit harnesses) there is no box and no existing root,
 * so every call roots exactly as before.
 */
const rootOrAdopt = <A, E>(
  program: Effect.Effect<A, E, never>,
  existingRoot: Tracer.Span | undefined,
  identity: RequestSpanIdentity
): Effect.Effect<A, E, never> => {
  if (existingRoot !== undefined) return program.pipe(Effect.withParentSpan(existingRoot))
  const { method, route, requestId } = identity
  return program.pipe(
    Effect.withSpan(`http.server ${method} ${route}`, {
      attributes: { method, route, 'request.id': requestId },
    })
  )
}
