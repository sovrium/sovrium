/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Build the domain runtime and the Hono app that runs on it.
 *
 * Everything a request needs to be answered and NOTHING about how a request
 * arrives — no port, no socket, no banner. It lives beside `server.ts` rather
 * than inside it because there are now two callers with different endings:
 * `createServer` goes on to bind a listener, and `render-app.ts` goes on to
 * render through `app.fetch` and never binds at all.
 */

import { Effect } from 'effect'
import { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import { formatRuntimeError } from '@/infrastructure/logging/format-runtime-error'
import { createHonoApp } from '@/infrastructure/server/compose-hono-app'
import { createDomainRuntime } from '@/infrastructure/server/domain-runtime'
import type { DomainContext, DomainRuntime } from '@/infrastructure/server/domain-runtime'
import type { ServerConfig } from '@/infrastructure/server/server-config'
import type { Hono } from 'hono'

/**
 * Build the Hono application from a ServerConfig. Pure construction — no
 * network binding. Async because `createHonoApp` realpath()s the static-assets
 * root once at mount time (symlink-escape hardening — see setupPublicDirRoute).
 */
export const buildHonoAppFromConfig = (
  config: ServerConfig,
  domainContext: DomainContext
): Promise<Readonly<Hono>> =>
  createHonoApp({
    app: config.app,
    publicDir: config.publicDir,
    configHash: config.configHash ?? '',
    domainContext,
    renderPage: config.renderPage,
    renderNotFoundPage: config.renderNotFoundPage,
    renderErrorPage: config.renderErrorPage,
    ...(config.renderRssFeed !== undefined ? { renderRssFeed: config.renderRssFeed } : {}),
  })

/**
 * Build this server's domain runtime, resolve its services, and build the Hono
 * app from them — everything that must exist before the socket binds.
 *
 * Three steps, deliberately taken together, and the middle one deliberately
 * taken HERE rather than lazily on the first request:
 *
 *  - `ManagedRuntime.make` is lazy, so on its own it builds nothing.
 *  - `context()` builds the layer once and caches it. `ManagedRuntime` caches a
 *    FAILED build too, so a runtime first built on a request would be poisoned
 *    for the life of the process by one transient outage. Building at boot keeps
 *    the existing contract instead: a storage backend that will not open refuses
 *    the boot, with the diagnosis shipped specs assert on.
 *
 * A build failure is reported as `ServerCreationError`, which `createServer`
 * ALREADY declares. Reusing it rather than minting a class is the honest call:
 * this is a failure of `createServer` to create a server, which is precisely
 * what that error means, and a second tag would give callers two arms they would
 * handle identically. A global `Error` is what this used to raise, and Effect
 * Diagnostics is right to refuse it — an untagged failure is one no `catchTag`
 * can ever name.
 *
 * The cause is rendered through `formatRuntimeError` rather than `String(cause)`.
 * The realistic failure here is a tagged error whose whole payload is a `cause`
 * field — `StorageError` from a storage backend that will not open — and those
 * stringify to nothing useful, so the operator would have been handed a sentence
 * with `[object Object]` where the diagnosis should be.
 */
export const buildDomainRuntimeAndApp = (
  config: ServerConfig
): Effect.Effect<
  {
    readonly runtime: DomainRuntime
    readonly context: DomainContext
    readonly honoApp: Readonly<Hono>
  },
  ServerCreationError
> =>
  Effect.gen(function* () {
    const runtime = createDomainRuntime(config.app)
    const context = yield* Effect.tryPromise({
      try: () => runtime.context(),
      catch: (cause: unknown) =>
        new ServerCreationError(
          `Sovrium could not build its application services: ${formatRuntimeError(cause)}`
        ),
    })
    // effect-promise: total -- `createHonoApp` is route registration plus one `realpath()`; it was awaited exactly this way before the runtime existed, and a throw from it is a programming error rather than an outcome.
    const honoApp = yield* Effect.promise(() => buildHonoAppFromConfig(config, context))
    return { runtime, context, honoApp }
  })
