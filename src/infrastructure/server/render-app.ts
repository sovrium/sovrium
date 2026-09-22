/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The render path: build an app to produce HTML from, and bind nothing.
 *
 * `createServer`'s sibling, and the sequence is deliberately the FIRST HALF of
 * its own — the operator-environment validations, the CSS compile, the domain
 * runtime, the Hono app — stopping exactly where the socket would come in.
 *
 * ## What is not here, and why none of it was ever wanted
 *
 * The static render pass drives `toSSG` over `app.fetch`, in-process
 * (`ssg-adapter.ts`), so a listener serves no request it makes. Until now the
 * pass asked `serverFactory.create` for a whole server anyway, purely to reach
 * the `app` field on what came back — and then STOPPED each server before
 * handing that app to the generator, which is the clearest statement available
 * that the socket was never the point. What it cost, per supported language
 * plus once for the root index: a real TCP bind, a published bound origin, four
 * scheduler arm-ups on a runtime about to be disposed, and a
 * `[server] stopped` line in front of every operator running `sovrium build`.
 *
 * So this function is not `createServer` with a flag. A flag would have had to
 * turn off the one step `createServer` exists to perform, and would have left
 * the listener describable in the config type. [internal ref] and
 * [internal ref] count the sockets a start and a build open; both
 * expect zero, and zero is only reachable by there being no bind to skip.
 *
 * ## What IS here, and why each one earns its place on a render
 *
 * - The env validations, shared verbatim with the boot path as
 *   `validateOperatorEnv`. A malformed `STORAGE_TRANSFORM_PRESETS`, storage
 *   public-access or `ECO_*` value must refuse the build at the top rather than
 *   surfacing on whichever page first touches that lever — a half-emitted site
 *   is worse than a refused one.
 * - The CSS compile, and it stays HERE rather than moving to `generateCssFile`
 *   (`use-cases/server/generate-static.ts`), which writes the stylesheet the
 *   emitted HTML links. Two reasons, both checkable. First, ORDER: that writer
 *   is step 5 of the pass and the HTML is step 4, so a theme that will not
 *   compile would be reported only after a whole site had been written to disk.
 *   Second, the render pass really does REQUEST the stylesheet: `toSSG` crawls
 *   every param-free `GET` the app registers, `/assets/output.css` is one
 *   (`route-setup/static-assets.ts`), and `shouldExcludeRoute`
 *   (`ssg-adapter.ts`) does not exclude it — so the compile happens during the
 *   pass either way, and `compileCSS` being per-theme cached is what makes
 *   doing it up front free rather than doubled.
 * - The domain runtime and the app built on its resolved services. That is the
 *   whole product of this function.
 *
 * ## What it deliberately does NOT run
 *
 * Neither process-wide chain: not `runDatabaseStartup`, not
 * `runDeferredStartupMaintenance`. Both belong to the process rather than to
 * anything built here, and the caller runs them once ahead of the render pass
 * (`startServer` before `prepareSearchArtifacts`, `build` before its own pass).
 * That ordering is a PRECONDITION rather than an optimisation: these renders
 * used to be what created the tables they render against, so a page bound to a
 * `dataSource` needs its table to already exist — [internal ref] is
 * the criterion that says so.
 */

import { Effect } from 'effect'
import { compileCSS } from '@/infrastructure/css/compiler'
import { buildDomainRuntimeAndApp } from '@/infrastructure/server/build-domain-app'
import { disposeDomainRuntime } from '@/infrastructure/server/domain-runtime'
import { validateOperatorEnv } from '@/infrastructure/server/validate-operator-env'
import type { RenderApp, RenderAppConfig } from '@/application/ports/services/server-factory'
import type { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import type { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import type { TransformPresetError } from '@/infrastructure/errors/transform-preset-error'

/**
 * Build a Hono app to render through, plus the one call that releases it.
 *
 * `dispose` is the shared `disposeDomainRuntime` and nothing else — there is no
 * socket to drain ahead of it and no process-wide telemetry teardown to perform
 * on behalf of a listener that has not bound yet, which is exactly the carve-out
 * `createStopEffect` used to need a flag for. It logs and absorbs its own
 * failure for the same reason the stop sequence does; the reason is written
 * down beside the release rather than here.
 *
 * ## Why this is NOT a scoped resource (standing rule E3)
 *
 * E3 says a resource with a lifetime is a `Layer.effect` whose body acquires
 * with `Effect.acquireRelease` — which is what the cron registry and the two pg
 * `LISTEN` clients are, on the scope of the runtime this function builds. A
 * render app has a lifetime too, so the shape was considered and rejected on
 * two counts.
 *
 * The first is that it buys no guarantee that is missing. E3 exists because a
 * disposer someone has to remember to call is a disposer that runs on the happy
 * path only; the three call sites in `static-language-generators.ts` use
 * `Effect.ensuring`, which runs on success, failure AND interruption, so the
 * exit paths are already the scope's exit paths. What a scope would add is that
 * OMITTING the release stops compiling — a real but narrow win.
 *
 * The second is that it would move the mistake rather than remove it, into a
 * quieter place. Making `buildRenderApp` scoped puts `Scope` in the port's
 * requirement channel, and the multi-language pass then has to place
 * `Effect.scoped` INSIDE its `Effect.forEach` body. Placed outside, or omitted
 * so the requirement floats up to the caller's runtime, every language's
 * runtime — database clients, storage backend, pg sockets — is held until the
 * whole pass ends, with nothing failing and nothing logged. That is strictly
 * worse than the failure it replaces: a missing `Effect.ensuring` is visible in
 * a diff, N held runtimes are visible only in memory. The `concurrency: 1`
 * comment on that loop exists to keep exactly one of these alive at a time.
 *
 * Revisit if a fourth caller appears: the argument above is about three call
 * sites in one file, and it does not survive the release being spread across
 * modules that cannot see each other.
 */
export const createRenderApp = (
  config: RenderAppConfig
): Effect.Effect<
  RenderApp,
  ServerCreationError | CSSCompilationError | TransformPresetError | Error
> =>
  Effect.gen(function* () {
    // Literally the same validations a real boot runs, because it is the same
    // effect: refuse a malformed operator lever before anything is built.
    yield* validateOperatorEnv
    yield* compileCSS(config.app)
    const domain = yield* buildDomainRuntimeAndApp(config)
    return {
      app: domain.honoApp,
      dispose: disposeDomainRuntime(domain.runtime),
    }
  })
