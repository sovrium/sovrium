/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * In-place hot swap for `sovrium start --watch`.
 *
 * A reload used to mean a full teardown: stop the listener, wait for the port
 * to be released, rebuild everything, rebind. Most saves change only what the
 * request handler RENDERS, and `Bun.serve().reload({ fetch, websocket })`
 * replaces the handler of a LIVE listener — the socket never closes, so no
 * connection is dropped, no port is briefly unbound, and nothing has to be
 * waited for. (Verified upstream: `vendor/bun/test/js/bun/http/bun-server.test.ts`.)
 *
 * What this path deliberately does NOT re-run is the whole of boot. Migrations,
 * the admin bootstrap, cron registration, the AI listeners, env validation and
 * the startup banner all stay put: they are either not idempotent or not
 * cheap, and the classifier
 * (`@/application/use-cases/config/classify-config-change`) is what guarantees
 * only saves that need none of them arrive here.
 *
 * Three things DO travel with the swap, because leaving them behind would make
 * the reloaded server lie about itself:
 *  - the `X-Sovrium-Config` hash, which is how an operator answers "which
 *    config is this actually running?" from any response;
 *  - the lock file and its SIGUSR1 reload target, which name the running
 *    config for `sovrium stop` / `sovrium restart`;
 *  - the dev live-reload push, because a surviving listener has no reconnect
 *    left to carry the news to an open browser tab.
 */

import { Effect } from 'effect'
import { LockFileWriteError } from '@/infrastructure/errors/lock-file-write-error'
import { ServerReloadError } from '@/infrastructure/errors/server-reload-error'
import { logDebug, logWarning } from '@/infrastructure/logging/logger'
import { notifyDevReload } from '@/infrastructure/realtime/dev-reload-channel'
import { writeLockFile as writeLockFileToDisk } from '@/infrastructure/server/lock-file'
import { registerLockFileCleanup } from '@/infrastructure/server/lock-file-cleanup'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

/** Everything the swap needs that only `createServer` can supply. */
export interface ServerReloadDeps {
  /** The live listener whose handler is replaced. Never stopped. */
  readonly server: ReturnType<typeof Bun.serve>
  /** Build the Hono app for the new config, carrying the new config hash. */
  readonly buildHonoApp: (app: App, configHash: string) => Promise<Readonly<Hono>>
  /**
   * Replace the live listener's request handler with one serving `honoApp`.
   *
   * Passed in rather than built here because the `Bun.serve` option object is
   * `createServer`'s to shape — it carries the WebSocket handler the records
   * real-time transport upgrades onto, and rebuilding it from a narrower type
   * here would be a second, silently divergent definition of what this server
   * serves.
   */
  readonly swapHandler: (honoApp: Readonly<Hono>) => void
  /** Absolute config path recorded in the lock file; `''` when there is none. */
  readonly configPath: string
  /** A silent server owns no lock file and registers no cleanup — see `createServer`. */
  readonly silent: boolean
}

/**
 * Rewrite the lock file so `sovrium stop` / `sovrium restart` keep naming the
 * config the process is now running. The port is unchanged by construction —
 * that is the whole point of the swap — so only the hash moves. Best-effort,
 * exactly as at boot: a lock-file write failure must not take a dev server
 * down.
 */
const refreshLockFile = (
  port: number,
  configHash: string,
  configPath: string
): Effect.Effect<void, never> =>
  Effect.tryPromise({
    try: () => writeLockFileToDisk({ pid: process.pid, port, configHash, configPath }),
    catch: (cause) => new LockFileWriteError(cause),
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => {
        // Same warning as the boot-time write: a stale lock file makes
        // `sovrium stop` and `sovrium restart` act on the wrong generation.
        logWarning(`[server] could not refresh the lock file: ${String(cause)}`)
      })
    ),
    // effect-swallow: see the tap above, and the doc comment — a lock-file write
    // failure must not take a dev server down mid-reload.
    Effect.ignore
  )

/**
 * Build the `reload` member of a `ServerInstance`.
 *
 * Failure semantics matter as much as the success path. The new Hono app is
 * built BEFORE `server.reload` is called, so a config that cannot produce one
 * leaves the old handler in place and the listener still bound — the operator
 * keeps their port and their browser tab, and the watcher reports the failure.
 * That is the property `[internal ref]` pins: the old ordering stopped
 * the listener first and compiled second, so a stylesheet error unbound the
 * port while the watcher printed that the previous server was still serving.
 *
 * @param deps - The live listener and the builders bound to it.
 * @returns A `reload` function taking the DECODED new config plus the hash of
 *   the config file it came from.
 */
export const createServerReload =
  (deps: ServerReloadDeps) =>
  (app: App, configHash = ''): Effect.Effect<void, ServerReloadError> =>
    Effect.gen(function* () {
      logDebug('[server] hot-swapping the request handler…')

      const nextHonoApp = yield* Effect.tryPromise({
        try: () => deps.buildHonoApp(app, configHash),
        catch: (cause) => new ServerReloadError(cause),
      })

      // The swap itself. Synchronous, and the last point at which anything can
      // fail — everything below is bookkeeping on an already-live listener.
      //
      // ALREADY-OPEN STREAMS KEEP THE PREVIOUS APP, DELIBERATELY. `reload`
      // replaces the handler future requests enter; it cannot reach into a
      // response already being written. So an applicative SSE stream (record
      // subscriptions, presence, AI chat) and an upgraded WebSocket both keep
      // closing over the superseded App until the client goes away. Accepted
      // for a dev-only path, and bounded for the SSE half: `runEffectSse` caps
      // every stream at `SSE_STREAM_MAX_LIFETIME_MS` (25 s), after which the
      // browser reconnects into the new handler by itself. A WebSocket has no
      // such ceiling and holds the old closure for as long as the tab does.
      // Closing them here was considered and rejected: it would drop live data
      // connections on a save that changed a page's text, which is a worse
      // developer experience than a stream that is at most 25 s stale.
      yield* Effect.sync(() => deps.swapHandler(nextHonoApp))

      if (!deps.silent) {
        yield* refreshLockFile(deps.server.port ?? 0, configHash, deps.configPath)
        // Replace semantics — the controller swaps the SIGUSR1 target and
        // installs nothing, so a long `--watch` session does not accumulate
        // signal handlers holding superseded Hono apps alive.
        yield* Effect.sync(() => registerLockFileCleanup(nextHonoApp, deps.configPath))
      }

      // The listener survived, so no `EventSource` reconnected and nothing told
      // the page. Push it.
      yield* Effect.sync(() => notifyDevReload())
    })
