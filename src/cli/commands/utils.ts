/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { StartOptions } from '@/application/use-cases/server/start-server'

/**
 * Lazy-import heavy modules to avoid loading native dependencies (lightningcss,
 * @tailwindcss/oxide) for commands that don't need them (--version, schema, init).
 * This is critical for compiled binary mode where native .node modules cannot be
 * resolved from Bun's virtual filesystem.
 */
export const lazyImportIndex = () => import('@/index')
export const lazyImportLogger = () => import('@/infrastructure/logging/logger')
export const lazyImportStartupSummary = () => import('@/infrastructure/logging/startup-summary')
export const lazyImportSchema = () => import('@/infrastructure/schema')
export const lazyImportCli = () => import('@/presentation/cli')

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
  // eslint-disable-next-line functional/no-loop-statements
  while (Date.now() < deadline) {
    try {
      const probe = Bun.serve({ port, hostname, fetch: () => new Response() })
      probe.stop(true)
      return
    } catch (error) {
      const code = (error as { readonly code?: string } | null)?.code
      // Any non-EADDRINUSE error: give up probing and let start() surface it.
      if (code !== 'EADDRINUSE') return
      // eslint-disable-next-line functional/no-expression-statements
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }
}

/**
 * Reload server with new configuration from changed config file
 *
 * This function is called when the config file changes during --watch mode.
 * Uses dynamic imports to avoid loading native modules at startup.
 */
export const reloadServer = async (
  filePath: string,
  currentServer: {
    readonly stop: () => Promise<void>
    readonly server?: { readonly port?: number }
  },
  options: StartOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic import return type
): Promise<any> => {
  const { start } = await lazyImportIndex()
  const { loadSchemaFromFileForReload } = await lazyImportCli()

  // Parse the new config file (throws on invalid JSON/YAML, doesn't exit process)
  const newApp = await loadSchemaFromFileForReload(filePath)

  // DECODE BEFORE STOPPING. `start()` decodes too, through this same shared
  // pipeline and deterministically, so running it here is a pre-flight rather
  // than a second opinion — and it is what makes the watcher's "keep the old
  // server running on error" promise true for the class of error a `--watch`
  // operator actually produces. Before this, the stop happened first and the
  // decode happened inside `start()`, so a typo'd property took the dev server
  // down and left the port unbound; strict boot then widened that from "a
  // malformed value" to "any key AppSchema does not declare".
  //
  // Only the CONFIG class is pre-flighted. CSS compilation and database
  // migrations still run after the stop and can still leave the server down —
  // they touch the filesystem and the database, so there is no side-effect-free
  // way to ask them the question in advance.
  const { decodeAppConfigObject } = await import('@/application/use-cases/schema/decode-app-config')
  const { ConfigRejectedError } = await import('@/domain/errors/config-rejected')
  const decoded = decodeAppConfigObject(newApp)
  if (!decoded.valid) {
    // eslint-disable-next-line functional/no-throw-statements -- surfaced by the watcher's catch
    throw new ConfigRejectedError(decoded.errors.join('\n'))
  }

  // Capture the live port so the reload rebinds the SAME port the browser is on.
  const boundPort = currentServer.server?.port
  const hostname = options.hostname ?? Bun.env.HOSTNAME ?? 'localhost'

  // Stop the current server before starting the new one
  // eslint-disable-next-line functional/no-expression-statements
  await currentServer.stop()

  // Clear in-memory render caches so the reloaded config is recompiled from
  // scratch. Defense-in-depth: the CSS cache key already keys on the app's class
  // candidates (so a className edit busts it), but these process-global caches
  // survive the in-process restart, so an explicit clear guarantees freshness.
  const { Effect } = await import('effect')
  const { clearCSSCache } = await import('@/infrastructure/css/cache/css-cache-service')
  const { clearPageCache } = await import('@/infrastructure/server/cache/page-cache-service')
  // eslint-disable-next-line functional/no-expression-statements
  await Effect.runPromise(Effect.all([clearCSSCache(), clearPageCache()]))

  // Rebind the same port deterministically: wait for the just-stopped listener
  // to release it, then pass it explicitly so the reload never drifts to a
  // random port.
  const reloadOptions: StartOptions =
    typeof boundPort === 'number' && boundPort > 0 ? { ...options, port: boundPort } : options
  if (typeof boundPort === 'number' && boundPort > 0) {
    // eslint-disable-next-line functional/no-expression-statements
    await waitForPortRelease(boundPort, hostname)
  }

  // Start new server with the updated config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- StartOptions from dynamic import
  const newServer = await start(newApp, reloadOptions as any)

  return newServer
}
