/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { classifyConfigChange } from '@/application/use-cases/config/classify-config-change'
import { hasPageSearchComponent } from '@/domain/models/app/pages/has-page-search'
import { printJournalWarning } from '@/infrastructure/logging/cli-output'
import { formatRuntimeError } from '@/infrastructure/logging/format-runtime-error'
import { computeConfigHash } from '@/infrastructure/server/lock-file'
import type { ConfigChangeVerdict } from '@/application/use-cases/config/classify-config-change'
import type { StartOptions } from '@/application/use-cases/server/start-server'
import type { App, AppEncoded } from '@/domain/models/app'
import type { SimpleServer } from '@/index'

/**
 * Lazy-import heavy modules to avoid loading native dependencies (lightningcss,
 * @tailwindcss/oxide) for commands that don't need them (--version, schema, init).
 * This is critical for compiled binary mode where native .node modules cannot be
 * resolved from Bun's virtual filesystem.
 */
export const lazyImportIndex = () => import('@/index')
export const lazyImportLogger = () => import('@/infrastructure/logging/logger')
export const lazyImportStartupSummary = () => import('@/infrastructure/logging/startup-summary')
export const lazyImportSchema = () => import('@/infrastructure/config')
export const lazyImportCli = () => import('@/cli/runtime/schema-loader')

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
 * The outcome of a successful reload: the server now serving, the files the
 * reloaded config is made of — the set the watcher must follow from now on —
 * and the decoded config the next save will be diffed against.
 */
export interface ReloadedServer {
  readonly server: SimpleServer
  readonly files: ReadonlyArray<string>
  readonly app: App
}

/** Everything one reload needs. An object because there are five of them. */
export interface ReloadServerParams {
  /** Path of the config graph's root file. */
  readonly filePath: string
  readonly currentServer: SimpleServer
  /** The decoded config the running server was built from. */
  readonly currentApp: App
  readonly options: StartOptions
  /**
   * Called once the save has been classified and BEFORE anything is done about
   * it, so the watcher can tell the operator which of the two paths this save
   * is taking — and, on a restart, which key forced it.
   */
  readonly announce: (verdict: ConfigChangeVerdict) => void
}

/** What identifies the config a server is running, on boot and on reload. */
export interface ConfigAnchor {
  /** Hash published as `X-Sovrium-Config` and recorded in the lock file. */
  readonly configHash: string
  /** Absolute path of the config's root file; `''` when the config is inline. */
  readonly configPath: string
}

/**
 * Resolve the anchor for a config, from its file when there is one.
 *
 * ONE definition of "which config is this", shared by the boot call in
 * `handleStartCommand` and by every `--watch` reload. Keeping the two in step
 * matters more than the three lines it saves: the hash is what
 * `X-Sovrium-Config` publishes and what the lock file records, so a boot and a
 * reload that hashed different bytes would make a server disagree with itself
 * about what it is running.
 *
 * `configFile` is absent only for an inline config (`APP_SCHEMA=…`), which has
 * no file to read and no path to record — the config's own serialization is
 * then the only thing there is to hash.
 */
export const resolveConfigAnchor = async (
  configFile: string | undefined,
  inlineConfig: AppEncoded
): Promise<ConfigAnchor> =>
  configFile
    ? {
        configHash: computeConfigHash(await readFile(configFile, 'utf-8')),
        configPath: resolve(configFile),
      }
    : { configHash: computeConfigHash(JSON.stringify(inlineConfig)), configPath: '' }

/**
 * Whether a config declares a page-scoped `search-input`, and therefore wants the
 * search artifacts materialized.
 *
 * The cast is the point of the wrapper. `hasPageSearchComponent` takes the
 * decoded `App` while the reload path holds the encoded `AppEncoded`; the
 * predicate only reads `.pages` and `.components`, which are shape-compatible
 * across the two, so the cast is safe — but it does not belong at a call site.
 *
 * The BOOT path no longer comes through here: `startServer` asks the same
 * question of the already-decoded `App` (`resolveEffectivePublicDir` in
 * `application/use-cases/server/start-server.ts`) and needs no cast at all.
 */
const needsSearchIndex = (rawApp: AppEncoded): boolean =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AppEncoded vs App; the predicate only reads .pages/.components
  hasPageSearchComponent(rawApp as any)

/**
 * Build the page-search index for a config, reporting failures to `onError`.
 *
 * The index is a BUILD ARTIFACT, not a lazily-computed response: it is written
 * into the public directory and the static-asset route then serves it as an
 * ordinary file. The BOOT emission belongs to `startServer` now, so this is
 * the RELOAD half only — a `--watch` developer who adds a page would otherwise
 * watch it render correctly and stay unfindable, silently, because the search
 * box keeps working and simply returns nothing. It runs before the watcher
 * reports the reload done, so "the page is live" and "the page is findable"
 * become true together.
 *
 * A failure is always swallowed: an index that could not be built must not
 * take the server down with it. `onError` decides only how it is REPORTED —
 * the watcher labels its line `[watch]`.
 */
const buildSearchIndex = async (
  rawApp: AppEncoded,
  publicDir: string,
  onError: (error: unknown) => void
): Promise<void> => {
  const { prebuildSearchIndex } = await lazyImportIndex()
  // `await`, not `return`: the indexer resolves with a value this function
  // deliberately does not surface, and returning `.catch(onError)` directly
  // would widen the result to `boolean | void`.
  // eslint-disable-next-line functional/no-expression-statements -- CLI side effect: emit the search artifacts
  await prebuildSearchIndex(rawApp, publicDir).catch(onError)
}

/** Rebuild the page-search index for a reloaded config. */
const rebuildSearchIndex = async (rawApp: AppEncoded, publicDir: string): Promise<void> => {
  if (!needsSearchIndex(rawApp)) return
  return buildSearchIndex(rawApp, publicDir, (error) => {
    // A WARNING, not an error (T41): the reload itself succeeded and the pages
    // are live — only the search index behind them is stale. A multi-line cause
    // is split into stamped continuation rows by the printer.
    printJournalWarning('watch', `Search index not rebuilt: ${formatRuntimeError(error)}`)
  })
}

/**
 * Tear the listener down and boot a fresh server on the same port.
 *
 * The expensive path, taken only when the save changed something the boot
 * installed and cannot re-install in place (see `classifyConfigChange`). The
 * port-release probe stays HERE and only here: it exists because `stop()` can
 * leave the socket briefly held, and there is no stop on the hot path for it
 * to guard.
 */
const restartServer = async (
  params: ReloadServerParams,
  rawApp: AppEncoded,
  anchor: ConfigAnchor
): Promise<SimpleServer> => {
  const { start } = await lazyImportIndex()
  const { currentServer, options } = params
  const boundPort = currentServer.port
  const hostname = options.hostname ?? Bun.env.HOSTNAME ?? 'localhost'

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

  // `configHash`/`configPath` are threaded through DELIBERATELY. They used to
  // be passed only on `handleStartCommand`'s boot call, so the middleware that
  // emits `X-Sovrium-Config` was never mounted on a reloaded app and the header
  // vanished after the first save — the response that identifies which config a
  // server is running went silent exactly when it had something new to say.
  return start(rawApp, { ...options, ...rebind, reload: true, ...anchor })
}

/**
 * Reload the server from a changed config file.
 *
 * Called when any file of the config graph changes during `--watch`. Loads the
 * new config, decodes it ONCE, classifies the change, and then takes one of
 * two paths: an in-place handler swap into the live listener, or a full
 * teardown and rebind. Uses dynamic imports to avoid loading native modules at
 * startup.
 *
 * DECODE BEFORE ANYTHING ELSE. `start()` decodes too, through this same shared
 * pipeline and deterministically, so running it here is a pre-flight rather
 * than a second opinion — and it is what makes the watcher's "keep the old
 * server running on error" promise true for the class of error a `--watch`
 * operator actually produces: a typo'd property never costs them the port. The
 * decoded value is then handed onward rather than re-derived, so one save
 * decodes once.
 */
export const reloadServer = async (params: ReloadServerParams): Promise<ReloadedServer> => {
  const { filePath, currentServer, currentApp, options, announce } = params
  const { loadSchemaGraphForReload } = await lazyImportCli()

  // Load the new config FRESH (throws on invalid JSON/YAML/TS, doesn't exit
  // process) and learn which files it is made of.
  const { config: rawApp, files } = await loadSchemaGraphForReload(filePath)

  const { decodeAppConfigObject } = await import('@/application/use-cases/config/decode-app-config')
  const { ConfigRejectedError } = await import('@/domain/errors/config-rejected')
  const decoded = decodeAppConfigObject(rawApp)
  if (!decoded.valid) {
    // eslint-disable-next-line functional/no-throw-statements -- surfaced by the watcher's catch
    throw new ConfigRejectedError(decoded.errors.join('\n'))
  }

  const anchor = await resolveConfigAnchor(filePath, rawApp)
  const verdict = classifyConfigChange(currentApp, decoded.app)
  announce(verdict)

  const server =
    verdict.kind === 'hot'
      ? await currentServer.reload(decoded.app, anchor.configHash).then(() => currentServer)
      : await restartServer(params, rawApp, anchor)

  if (options.publicDir) {
    await rebuildSearchIndex(rawApp, options.publicDir)
  }

  return { server, files, app: decoded.app }
}
