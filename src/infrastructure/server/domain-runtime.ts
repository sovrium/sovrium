/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The server-owned domain `ManagedRuntime` — the runtime that holds the
 * application's services for as long as the listener is bound.
 *
 * Contract, and it is the load-bearing one of the Effect programme:
 *
 * > **The domain `ManagedRuntime` is owned by the `ServerInstance`**: created in
 * > `createServer`, handed to route setup as a parameter, disposed in
 * > `createStopEffect`. **Never a module-level singleton.**
 *
 * ### Why never a singleton
 *
 * `serverMode: 'inprocess'` boots the server INSIDE the Playwright worker, many
 * times per process — `[internal ref]` calls
 * `resetDbCache()` on every boot for exactly this class of contamination. A
 * module-level runtime frozen on the first app's `auth` config would then serve
 * every later spec, and the failure would read as a flaky test rather than as a
 * shared-state bug. Everything here is therefore a factory or takes the context
 * as an argument; no module in this file holds a runtime.
 *
 * ### Why the context is resolved once, at boot, rather than per request
 *
 * {@link createDomainRuntime} is lazy: nothing is built until the first
 * `context()`/`run*`. `createServer` resolves it ONCE, before the listener
 * binds, and publishes the resolved {@link DomainContext} — not the runtime — to
 * every request. Three reasons, in order of weight:
 *
 *  1. **A layer build failure stays a boot failure.** `ManagedRuntime` memoises
 *     its build, INCLUDING a failed one, so a lazily-built runtime that hit a
 *     transient outage on its first request would be poisoned for the life of
 *     the process. Resolving at boot keeps today's semantics: a storage backend
 *     that will not open refuses the boot, loudly, with the message shipped
 *     specs assert on.
 *  2. **No request ever pays a layer build.** The per-request cost is a context
 *     lookup, not a `Layer` construction — which is the whole point of retiring
 *     the per-folder `effect-runner.ts` files, each of which rebuilt its layers
 *     on every call.
 *  3. It is what makes `app-layer.test.ts`'s better-auth laziness probe
 *     meaningful: a no-auth boot now builds the whole domain layer, so "zero
 *     `better-auth` modules loaded" is a claim about the runtime rather than
 *     about a runtime nobody built.
 *
 * ### `--watch`
 *
 * A hot swap KEEPS the runtime. Of everything the runtime reads off the config,
 * `app.auth`, `app.tables` and `app.agents` are all in `RESTART_KEYS`
 * (`application/use-cases/config/classify-config-change.ts`), so a save that
 * could invalidate the runtime forces a full restart by construction rather
 * than by care. A full restart stops the server, which disposes the runtime,
 * and the next `createServer` builds a fresh one.
 */

import { Effect, Layer as LayerModule, ManagedRuntime } from 'effect'
import { ApprovalLayer } from '@/application/use-cases/agents/approval'
import { AutomationRuntimeLayer } from '@/infrastructure/automations/runtime-layer'
import { makeAiComputeListenerLayer } from '@/infrastructure/database/ai-compute-listener'
import { makeAiKnowledgeListenerLayer } from '@/infrastructure/database/ai-knowledge-listener'
import { AiActivityLogRepositoryLive } from '@/infrastructure/database/repositories/ai/ai-activity-log-repository-live'
import { AiFactsRepositoryLive } from '@/infrastructure/database/repositories/ai/ai-facts-repository-live'
import { AiMemoryRepositoryLive } from '@/infrastructure/database/repositories/ai/ai-memory-repository-live'
import { FormSubmissionRepositoryLive } from '@/infrastructure/database/repositories/forms/form-submission-repository-live'
import { DynamicRecordRepositoryLive } from '@/infrastructure/database/repositories/tables/dynamic-record-repository-live'
import { createAppLayer } from '@/infrastructure/layers/app-layer'
import { logError } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'
import type { Context, Layer } from 'effect'
import type { Context as HonoContext } from 'hono'

/**
 * Everything the runtime holds: the shared application services, plus the two
 * PostgreSQL `LISTEN`/`NOTIFY` connections whose lifetime is the server's.
 *
 * The listeners are here rather than in `createAppLayer` for one reason —
 * `createAppLayer` takes only `app.auth`, while they need the tables, the agent
 * knowledge bindings and the app name. Widening that signature would have
 * reached every one of its callers (`src/index.ts`, the static build, the
 * better-auth laziness probe) for a resource none of them owns. Composing here
 * keeps the insertion to this file.
 *
 * They are scoped layers (W4 / standing rule E3): `Effect.acquireRelease` over
 * a `pg` `Client`, released when this runtime is disposed. Nothing yields them
 * — they are subscriptions, not services a request consumes — but a layer has
 * to provide something to be nameable in a merged list, so each reports whether
 * it actually managed to `LISTEN`.
 *
 * ### Why the automation runtime is here too
 *
 * `AutomationRuntimeLayer` is the single, deliberate composition of the
 * automation engine's services, and its own header records why there must be
 * exactly one: a previous smaller twin made a handler work from a webhook
 * trigger and fail from a record trigger, a difference no type caught. Merging
 * it HERE, rather than at each entry point, is what makes that single
 * composition reachable from the four entry points that hold no request —
 * the cron scheduler, the Better Auth hooks, the MCP tool dispatcher and the
 * comment-trigger dispatcher — which is what let the last route-folder runners
 * retire.
 *
 * It is a partial superset of `createAppLayer`: `AuthRepository`,
 * `AnalyticsRepository`, the two connection repositories, the automation pause
 * and run repositories, `AiService`, `StorageService` and
 * `ImageTransformService` appear in both. Naming a layer twice builds it once —
 * Effect memoises by layer identity — and both names resolve to the same
 * module-level `Layer`, so there is no second implementation to disagree with
 * the first.
 */
const domainLayerFor = (app: App | undefined) =>
  LayerModule.mergeAll(
    createAppLayer(app?.auth),
    AutomationRuntimeLayer,
    // The form-submission extras that are NOT in the automation runtime:
    // the submission ledger, and the analytics/table/data-source services a
    // submission shares with it. Only `FormSubmissionRepository` is genuinely
    // additional; the rest are named by `AutomationRuntimeLayer` already and
    // are left to it.
    FormSubmissionRepositoryLive,
    // The AI route folder's repositories. `AiService` itself already arrives
    // through `createAppLayer`.
    AiMemoryRepositoryLive,
    AiFactsRepositoryLive,
    AiActivityLogRepositoryLive,
    DynamicRecordRepositoryLive,
    // The agent-approval mirror, reached from the cron-driven schedule runner
    // as well as from the approval routes.
    ApprovalLayer,
    makeAiComputeListenerLayer(app),
    makeAiKnowledgeListenerLayer(app)
  )

/** The domain layer a server runtime provides, as one type. */
type DomainLayer = ReturnType<typeof domainLayerFor>

/**
 * Every service the server runtime carries.
 *
 * Derived from {@link domainLayerFor} rather than enumerated, so a layer added
 * to `createAppLayer` is available to routes without a second list drifting
 * behind it.
 */
export type DomainServices = Layer.Success<DomainLayer>

/** What building the domain layer can fail with. Surfaced at boot, never per request. */
type DomainLayerError = Layer.Error<DomainLayer>

/** The server's runtime. One per `ServerInstance`, disposed with it. */
export type DomainRuntime = ManagedRuntime.ManagedRuntime<DomainServices, DomainLayerError>

/** The resolved services, as handed to every request. */
export type DomainContext = Context.Context<DomainServices>

/**
 * Build a domain runtime for one server.
 *
 * Lazy — no layer is constructed until the first `context()` or `run*`. The
 * caller owns it and releases it through {@link disposeDomainRuntime}: a
 * listener does so in `createStopEffect`, after the socket drain; a render app
 * does so in the `dispose` it hands back (`render-app.ts`).
 *
 * Takes the WHOLE `App` (not just `app.auth`) because the scoped listener
 * layers read the tables and the agent knowledge bindings. `undefined` builds a
 * runtime with no auth and both listeners inert, which is what the unit tests
 * and any config-less harness want.
 */
// `DomainRuntime` is a local alias for an Effect-owned `ManagedRuntime`.
// `functional/prefer-immutable-types` exempts Effect's own types by ANNOTATION
// TEXT, and a local alias is exactly the case
// that lever cannot see — the same disable `observability-runtime.ts` carries on
// its `ObsRuntime` alias, for the same reason.
// eslint-disable-next-line functional/prefer-immutable-types -- DomainRuntime is an alias
export const createDomainRuntime = (app?: App): DomainRuntime =>
  ManagedRuntime.make(domainLayerFor(app))

/**
 * Release a domain runtime's layer scope, absorbing — but never hiding — a
 * finalizer that fails.
 *
 * The release itself must not fail its caller. Both callers reach this at a
 * point where failing would be strictly worse than continuing: a stop must keep
 * draining and flush telemetry so the process can exit, and a render's teardown
 * runs after the HTML it produced is already on disk, so failing there would
 * discard a build that succeeded. That is why the rejection is absorbed.
 *
 * What it is NOT allowed to be is silent. Standing rule E6
 * — a swallowed failure is
 * logged with its cause and carries a written reason — and a scope finalizer is
 * precisely the kind of failure nothing else would ever report: the pg `LISTEN`
 * sockets, the cron registry and the database clients all release here, so a
 * connection that refuses to close used to leave no trace at all in either
 * caller. The log is the trace; the two paragraphs above are the reason.
 *
 * Absorbing INSIDE the thunk rather than with `Effect.ignore` is what keeps the
 * `Effect.promise` honest: the promise genuinely cannot reject, so the marker
 * below is a fact rather than a claim about the callee.
 */
export const disposeDomainRuntime = (
  // eslint-disable-next-line functional/prefer-immutable-types -- DomainRuntime is an alias
  runtime: DomainRuntime
): Effect.Effect<void, never> =>
  // effect-promise: total -- the `.catch` below handles every rejection and returns, so the thunk cannot reject.
  Effect.promise(() =>
    runtime.dispose().catch((cause: unknown) => {
      logError('[server] the domain runtime did not release cleanly', cause)
    })
  )

/**
 * The Hono variable the resolved context travels in.
 *
 * A per-request variable rather than a parameter threaded through every route
 * setup function: `c` is the one vector every handler already has, and the
 * alternative is a new argument on some hundred signatures for a value that
 * never changes within a server. The runtime is still handed to route setup as
 * a PARAMETER — `createHonoApp` receives it and mounts the middleware below —
 * which is the same vector the Better Auth instance travels on.
 */
const DOMAIN_CONTEXT_VAR = 'sovriumDomainContext'

/**
 * A box around the context.
 *
 * `Hono`'s untyped `c.get` answers `any`, so reading it back needs an
 * assertion. Asserting a one-field interface of ours rather than an
 * Effect-owned `Context.Context<…>` keeps the assertion off Effect's types,
 * where casting is banned outright (`unsafeEffectTypeAssertion`).
 */
interface DomainContextBox {
  readonly context: DomainContext
}

/**
 * Publish the resolved services to every request of this Hono app.
 *
 * Returns a middleware rather than taking the app, so the caller mounts it in
 * the position it wants — first, ahead of every route.
 *
 * The box is allocated ONCE, when the middleware is built, not per request: the
 * services are constant for the life of the server, so every request is handed
 * the identical object. That is also what makes "nothing is rebuilt per request"
 * measurable rather than merely asserted — see `domain-runtime.test.ts`.
 */
export const domainContextMiddleware = (context: DomainContext) => {
  const box: DomainContextBox = { context }
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is inherently mutable
  return async (c: HonoContext, next: () => Promise<void>): Promise<void> => {
    c.set(DOMAIN_CONTEXT_VAR, box)
    return next()
  }
}

/**
 * Read the services published for this request.
 *
 * EXPORTED so the read path itself can be exercised. `DOMAIN_CONTEXT_VAR` is
 * module-private and this codebase augments no `ContextVariableMap` (the only
 * mentions of it, in `route-setup/admin-route-guards.ts`, widen a `Hono` env
 * rather than declaring keys), so `c.get('sovriumDomainContext')` does not
 * typecheck anywhere. That is the intended shape: the key is an implementation
 * detail and this function is the contract.
 *
 * @throws When no server published them — a handler reached outside a booted
 *   server (a unit harness, the static build). Loud on purpose: the alternative
 *   is a missing-service defect thrown from somewhere inside the program, with
 *   nothing naming the actual mistake.
 */
export const requireDomainContext = (
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is inherently mutable
  c: HonoContext
): DomainContext => {
  const box = c.get(DOMAIN_CONTEXT_VAR) as DomainContextBox | undefined
  if (box === undefined) {
    // eslint-disable-next-line functional/no-throw-statements -- see the doc comment: a silent miss becomes an unattributable defect
    throw new Error(
      'No domain services on this request. `createHonoApp` publishes them from the runtime `createServer` owns; a handler running outside a booted server cannot use `provideDomain`.'
    )
  }
  return box.context
}

/**
 * Discharge a program's domain requirements from THIS request's services.
 *
 * This is the whole migration recipe, and W3b..n route folders should copy it
 * rather than inventing a second shape:
 *
 * ```ts
 * // before — the folder's own effect-runner rebuilt its layers on every call
 * const result = await runRequestEffect(c, program.pipe(provideAnalyticsLive, Effect.result))
 *
 * // after — the services were built once, at boot
 * const result = await runRequestEffect(c, provideDomain(c, program).pipe(Effect.result))
 *
 * // fire-and-forget stays fire-and-forget; only what provides it changes
 * void Effect.runPromise(provideDomain(c, program).pipe(Effect.ignore))
 * ```
 *
 * A folder's `effect-runner.ts` is retired when its LAST caller moves, never
 * before — two runners are never collapsed into one, because the per-folder
 * narrowing is a documented convention rather than duplication.
 *
 * `Effect.provide` over a resolved {@link DomainContext} — NOT over a `Layer`.
 * That distinction is the performance claim: a `Layer` is a recipe and providing
 * one builds it, whereas a context is the built result, so nothing is
 * constructed here no matter how many requests arrive.
 *
 * The return type is `Exclude<R, DomainServices>` rather than a bare `never`
 * because TypeScript cannot prove `Exclude<R, DomainServices>` collapses while
 * `R` is still generic — at any real call site `R` is concrete and it resolves
 * to `never`. Stating the `Exclude` is what keeps the requirement channel
 * honest; asserting `never` here would be exactly the laundering cast the
 * `unsafeEffectTypeAssertion` gate exists to refuse.
 */
export const provideDomain = <A, E, R extends DomainServices>(
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is inherently mutable
  c: HonoContext,
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, Exclude<R, DomainServices>> =>
  Effect.provide(program, requireDomainContext(c))

/**
 * Run a small domain program on THIS request's services and await it.
 *
 * The Promise-world adapter for handlers that are not themselves Effect-shaped:
 * a session guard, a middleware, a prefill helper. It is deliberately thinner
 * than `runRequestEffect` — no root span, no request log — because these are
 * sub-steps of a handler that already has both, not request boundaries of their
 * own. Reach for `runRequestEffect` when the program IS the request.
 *
 * It exists so a use-case can declare its `R` (standing rule E1) without every
 * caller having to become an `Effect.gen` in the same change. The rejection
 * behaviour is the caller's to choose: a program that must not throw pipes its
 * own `Effect.orElseSucceed` before it gets here, exactly as the use-cases that
 * used to swallow their own failures now do.
 *
 * The parameter names `DomainServices` in full rather than a generic
 * `R extends DomainServices`. `R` is covariant, so a program needing one
 * service still passes; and because the type is concrete,
 * `Exclude<DomainServices, DomainServices>` collapses to `never` here rather
 * than at the call site — which is what lets this run without the laundering
 * cast `provideDomain`'s own doc comment explains it must not make.
 */
export const runOnDomain = <A, E>(
  context: DomainContext,
  program: Effect.Effect<A, E, DomainServices>
): Promise<A> => Effect.runPromise(Effect.provide(program, context))

/**
 * {@link runOnDomain}, reading the context off a request.
 *
 * The request-path spelling, and the one nearly every caller wants: a handler
 * has `c`, not a `DomainContext`. Reach for `runOnDomain` only where there is
 * genuinely no request — a boot-time callback built inside `createHonoApp`,
 * for instance, which holds the context directly.
 */
export const runDomainPromise = <A, E>(
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is inherently mutable
  c: HonoContext,
  program: Effect.Effect<A, E, DomainServices>
): Promise<A> => Effect.runPromise(Effect.provide(program, requireDomainContext(c)))
