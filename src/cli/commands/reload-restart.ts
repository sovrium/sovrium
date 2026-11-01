/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lazyImportIndex } from '@/cli/runtime/lazy-modules'
import { resolveBindHost } from '@/domain/models/process-env/server-lifecycle'
import { isPortFree, resolveHostAddresses } from '@/infrastructure/server/port-availability'
import type { ConfigAnchor, ReloadServerParams } from './reload-server'
import type { StartOptions } from '@/application/use-cases/server/start-server-options'
import type { AppEncoded } from '@/domain/models/app'
import type { SimpleServer } from '@/index'

/**
 * The expensive half of a `--watch` reload: stop the listener, boot the new
 * config on the same port, and bring the last-good config back when it will
 * not boot. `reload-server.ts` decides when this runs.
 */

/**
 * Poll until `port` on `hostname` is free, or the deadline passes.
 *
 * Bun's `server.stop()` can leave the listening socket briefly held on
 * macOS/Windows. Rebinding too soon makes `createServer` hit EADDRINUSE and
 * silently fall back to an OS-assigned port (port 0) — which orphans the
 * operator's open browser tab at the original port. We confirm the port is
 * free (a throwaway listen succeeds) before the reload rebinds it.
 */
const waitForPortRelease = async (port: number, hostname: string, maxMs = 2000): Promise<void> => {
  const deadline = Date.now() + maxMs
  const addresses = await resolveHostAddresses(hostname)
  // Any failure but EADDRINUSE reads as free: the rebind then surfaces it itself.
  while (Date.now() < deadline && !isPortFree(hostname, port, addresses)) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

/** A restart that bound the port, or one that did not and what it left behind. */
export type RestartResult =
  | { readonly booted: true; readonly server: SimpleServer }
  | {
      readonly booted: false
      readonly error: unknown
      readonly rollbackError: unknown
      readonly serverState: 'rolled-back' | 'down'
      readonly server: SimpleServer
    }

/**
 * Tear the listener down, boot a fresh server on the same port, and bring the
 * last-good config back if the new one will not boot.
 *
 * The expensive path, taken only when the save changed something the boot
 * installed and cannot re-install in place (see `classifyConfigChange`). The
 * port-release probe stays HERE and only here: it exists because `stop()` can
 * leave the socket briefly held, and there is no stop on the hot path for it
 * to guard.
 *
 * ## Why a rollback, given there is now a pre-flight
 *
 * The pre-flight answers the questions that are cheap and read-only
 * (`reload-preflight.ts`). It cannot answer the rest — a stylesheet that will
 * not compile, a migration the plan could not simulate, a port that comes back
 * held — and a reload is not allowed to leave the operator with nothing for any
 * of them. So the pre-flight makes the common refusals free, and this makes the
 * uncommon ones survivable. Only when the last-good config ALSO fails to boot
 * is the server genuinely down, and only then may anything say so.
 */
export const restartServer = async (
  params: ReloadServerParams,
  rawApp: AppEncoded,
  anchor: ConfigAnchor
): Promise<RestartResult> => {
  const { start } = await lazyImportIndex()
  const { currentServer, options } = params
  const boundPort = currentServer.port
  const hostname = options.hostname ?? resolveBindHost(process.env).host

  await currentServer.stop()

  // No cache purge here. Both process-global render caches already invalidate
  // by CONTENT, so an edit busts them by construction and clearing them only
  // threw away entries the reload was about to re-derive: the CSS cache keys on
  // the theme AND the app's class candidates (`infrastructure/css/compiler.ts`,
  // pinned by `css-cache-service.test.ts`), and the page cache keys on the
  // app's `renderChecksum` (`infrastructure/server/cache/page-cache-service.ts`).
  // A config change that would render differently changes at least one of those
  // keys; a config change that would render identically is a cache HIT that is
  // correct to serve.

  // Rebind the same port deterministically: wait for the just-stopped listener
  // to release it, then pass it explicitly so the reload never drifts to a
  // random port. `reload: true` is what turns the fourteen-line startup banner
  // into the watcher's one-line summary — see `StartOptions.reload`.
  const rebind = boundPort > 0 ? { port: boundPort } : {}
  if (boundPort > 0) {
    await waitForPortRelease(boundPort, hostname)
  }

  // `configHash`/`configPath` are threaded through DELIBERATELY. Passed only on
  // `handleStartCommand`'s boot call, the middleware that emits
  // `X-Sovrium-Config` would never be mounted on a reloaded app and the header
  // would vanish after the first save — the response that identifies which
  // config a server is running going silent exactly when it has something new to say.
  const booted = await bootOrFail(start, rawApp, { ...options, ...rebind, reload: true, ...anchor })
  if ('server' in booted) return { booted: true, server: booted.server }

  return rollBackToLastGood(params, { boundPort, hostname, rebind, error: booted.error })
}

/** Boot `rawApp`, reporting a rejection as a value rather than a rejection. */
const bootOrFail = async (
  start: (app: AppEncoded, options: StartOptions) => Promise<SimpleServer>,
  rawApp: AppEncoded,
  options: StartOptions
): Promise<{ readonly server: SimpleServer } | { readonly error: unknown }> =>
  start(rawApp, options).then(
    (server) => ({ server }),
    (error: unknown) => ({ error })
  )

/**
 * Bring the retained last-good config back on the port the failed boot left
 * unbound.
 *
 * The recovery's OWN failure is carried out rather than swallowed: it is the
 * difference between `rolled-back` and `down`, and on `down` it is the second
 * half of what the operator has to read to know why they have no server. A
 * caught-and-dropped rollback error would turn the one genuine outage this
 * whole path admits to into an unexplained one.
 */
const rollBackToLastGood = async (
  params: ReloadServerParams,
  attempt: {
    readonly boundPort: number
    readonly hostname: string
    readonly rebind: { readonly port?: number }
    readonly error: unknown
  }
): Promise<RestartResult> => {
  const { start } = await lazyImportIndex()
  const { currentServer, currentRawApp, currentAnchor, options } = params
  const { boundPort, hostname, rebind, error } = attempt

  if (boundPort > 0) await waitForPortRelease(boundPort, hostname)
  const recovered = await bootOrFail(start, currentRawApp, {
    ...options,
    ...rebind,
    reload: true,
    ...currentAnchor,
  })

  return 'server' in recovered
    ? {
        booted: false,
        error,
        rollbackError: undefined,
        serverState: 'rolled-back',
        server: recovered.server,
      }
    : {
        booted: false,
        error,
        rollbackError: recovered.error,
        serverState: 'down',
        server: currentServer,
      }
}
