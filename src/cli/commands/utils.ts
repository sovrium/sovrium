/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { classifyConfigChange } from '@/application/use-cases/config/classify-config-change'
import { messageAsConfigFinding } from '@/domain/models/app/app-excess-property-report'
import { hasPageSearchComponent } from '@/domain/models/app/pages/has-page-search'
import { printJournalWarning } from '@/infrastructure/logging/cli-output'
import { formatRuntimeError } from '@/infrastructure/logging/format-runtime-error'
import { computeConfigHash } from '@/infrastructure/server/lock-file'
import type { ConfigChangeVerdict } from '@/application/use-cases/config/classify-config-change'
import type { StartOptions } from '@/application/use-cases/server/start-server'
import type { App, AppEncoded } from '@/domain/models/app'
import type { ConfigFinding } from '@/domain/models/app/app-excess-property-report'
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
 * and the config the next save will be diffed against, decoded and raw.
 *
 * The RAW config is retained alongside the decoded one because it is the only
 * form `start()` accepts, and a rollback has to be able to boot the last-good
 * config again. Keeping it here rather than re-reading the file is what makes
 * "last good" mean the bytes that actually booted, rather than whatever is on
 * disk at the moment the rollback needs them — which, after a bad save, is
 * precisely the thing that does not boot.
 */
export interface ReloadSuccess {
  readonly ok: true
  readonly server: SimpleServer
  readonly files: ReadonlyArray<string>
  readonly app: App
  readonly rawApp: AppEncoded
  readonly anchor: ConfigAnchor
}

/**
 * What the reload did to the LISTENER, which is the only thing the operator's
 * browser tab cares about and the only thing the printed sentence may claim.
 *
 * The three are mutually exclusive and exhaustive, and each maps to exactly one
 * sentence (see `describeReloadFailure` in `start.ts`). Making this a value
 * rather than a comment is the whole fix: the message used to be a constant
 * printed on every path, so "the previous server is still serving" was emitted
 * over a dead port and the operator went looking for the fault in their
 * browser.
 */
export type ReloadServerState =
  /** Nothing was stopped — the pre-flight refused the save, or it never got that far. */
  | 'kept'
  /** It was stopped, the new config would not boot, and the last-good one came back. */
  | 'rolled-back'
  /** It was stopped, the new config would not boot, and neither would the old one. */
  | 'down'

/** How far a failing reload got, for the operator and for the log. */
export type ReloadFailurePhase = 'load' | 'preflight' | 'boot'

/** A reload that did not happen, and what it left behind. */
export interface ReloadFailure {
  readonly ok: false
  /**
   * The files the attempt READ, even though it failed.
   *
   * The watched set used to be re-derived only from a successful reload, so a
   * save that introduced a `$ref` and then failed left that file unwatched —
   * and the file it left unwatched was the one the operator was about to edit,
   * because it was the one that was wrong. Empty only when the load itself
   * failed and there is nothing to report.
   */
  readonly files: ReadonlyArray<string>
  readonly phase: ReloadFailurePhase
  readonly serverState: ReloadServerState
  /**
   * The refusal, in the words the operator acts on. Non-empty only for a
   * pre-flight refusal, which is prose rather than a fault and must not be
   * rendered through a stack formatter.
   */
  readonly refusals: readonly string[]
  /**
   * The SAME refusal, located and structured — the shape `sovrium validate
   * --json` publishes and the shape the status file records.
   *
   * Never empty. `refusals` and `error` are for a person reading a terminal;
   * this is for the two readers that are not there — the supervisor polling
   * `status.json` and the browser tab holding an open dev-reload stream. A
   * refusal that could not be located is still published here with an empty
   * `path`, so a caller reading only this field has seen every reason.
   */
  readonly findings: readonly ConfigFinding[]
  readonly error: unknown
  /** Why the rollback ALSO failed, on `down` and nowhere else. */
  readonly rollbackError: unknown
  /** The server the watcher must hold from now on — a rollback replaces it. */
  readonly server: SimpleServer
}

/** What one save produced. */
export type ReloadOutcome = ReloadSuccess | ReloadFailure

/** Everything one reload needs. An object because there are several of them. */
export interface ReloadServerParams {
  /** Path of the config graph's root file. */
  readonly filePath: string
  readonly currentServer: SimpleServer
  /** The decoded config the running server was built from. */
  readonly currentApp: App
  /** The raw config the running server was built from — what a rollback boots. */
  readonly currentRawApp: AppEncoded
  /** The anchor the running server publishes as `X-Sovrium-Config`. */
  readonly currentAnchor: ConfigAnchor
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

/** A restart that bound the port, or one that did not and what it left behind. */
type RestartResult =
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
const restartServer = async (
  params: ReloadServerParams,
  rawApp: AppEncoded,
  anchor: ConfigAnchor
): Promise<RestartResult> => {
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

/**
 * Reload the server from a changed config file.
 *
 * Called when any file of the config graph changes during `--watch`. Loads the
 * new config, decodes it ONCE, classifies the change, and then takes one of
 * two paths: an in-place handler swap into the live listener, or a pre-flight
 * followed by a full teardown and rebind. Uses dynamic imports to avoid loading
 * native modules at startup.
 *
 * DECODE BEFORE ANYTHING ELSE. `start()` decodes too, through this same shared
 * pipeline and deterministically, so running it here is a pre-flight rather
 * than a second opinion — and it is what makes the watcher's "keep the old
 * server running on error" promise true for the class of error a `--watch`
 * operator actually produces: a typo'd property never costs them the port. The
 * decoded value is then handed onward rather than re-derived, so one save
 * decodes once.
 *
 * IT RETURNS ITS FAILURES RATHER THAN THROWING THEM, and that is the point of
 * the shape. A thrown error says what went wrong and nothing about what became
 * of the listener, so the caller had no choice but to print one fixed sentence
 * over three different outcomes — and it printed the reassuring one. A
 * {@link ReloadOutcome} carries `serverState`, so the sentence is derived from
 * what happened instead of assumed.
 */
export const reloadServer = async (params: ReloadServerParams): Promise<ReloadOutcome> => {
  const loaded = await loadAndDecode(params)
  if ('failure' in loaded) return loaded.failure

  const { rawApp, files, app, anchor, verdict } = loaded
  if (verdict.kind === 'hot') {
    await params.currentServer.reload(app, anchor.configHash)
    return finishReload(params, { server: params.currentServer, files, app, rawApp, anchor })
  }

  // The expensive path. Ask everything that is answerable while the listener is
  // still bound, BEFORE touching it — a refusal here costs the operator a log
  // line, where the same refusal one step later costs them their port.
  const { preflightRestartReload } = await import('./reload-preflight')
  const refusals = await preflightRestartReload(app)
  if (refusals.length > 0) {
    // A pre-flight refusal is prose with no position — it relates declarations
    // the decoder already accepted individually — so each one is published
    // whole under an empty path rather than given an invented one.
    return refused(params, {
      files,
      phase: 'preflight',
      refusals,
      findings: refusals.map((refusal) => messageAsConfigFinding(refusal)),
      error: undefined,
    })
  }

  const restarted = await restartServer(params, rawApp, anchor)
  if (!restarted.booted) {
    return {
      ok: false,
      files,
      phase: 'boot',
      serverState: restarted.serverState,
      refusals: [],
      findings: [messageAsConfigFinding(formatRuntimeError(restarted.error))],
      error: restarted.error,
      rollbackError: restarted.rollbackError,
      server: restarted.server,
    }
  }

  return finishReload(params, { server: restarted.server, files, app, rawApp, anchor })
}

/** A failure that never touched the listener. */
const refused = (
  params: ReloadServerParams,
  detail: {
    readonly files: ReadonlyArray<string>
    readonly phase: ReloadFailurePhase
    readonly refusals: readonly string[]
    readonly findings: readonly ConfigFinding[]
    readonly error: unknown
  }
): ReloadFailure => ({
  ok: false,
  files: detail.files,
  phase: detail.phase,
  serverState: 'kept',
  refusals: detail.refusals,
  findings: detail.findings,
  error: detail.error,
  rollbackError: undefined,
  server: params.currentServer,
})

/** What a load produced, or the failure that stands in for it. */
type LoadedConfig =
  | {
      readonly rawApp: AppEncoded
      readonly files: ReadonlyArray<string>
      readonly app: App
      readonly anchor: ConfigAnchor
      readonly verdict: ConfigChangeVerdict
    }
  | { readonly failure: ReloadFailure }

/**
 * Read the config graph, decode it, and classify the save — every step of which
 * happens while the running server is untouched, so any failure here is `kept`
 * by construction.
 */
const loadAndDecode = async (params: ReloadServerParams): Promise<LoadedConfig> => {
  const { filePath, currentApp, announce } = params
  const { loadSchemaGraphForReload } = await lazyImportCli()
  const { decodeAppConfigObject } = await import('@/application/use-cases/config/decode-app-config')
  const { ConfigRejectedError } = await import('@/domain/errors/config-rejected')

  const loaded = await loadSchemaGraphForReload(filePath).then(
    (result) => result,
    (error: unknown) => ({ error })
  )
  if ('error' in loaded) {
    return {
      failure: refused(params, {
        files: [],
        phase: 'load',
        refusals: [],
        findings: [messageAsConfigFinding(formatRuntimeError(loaded.error))],
        error: loaded.error,
      }),
    }
  }

  const { config: rawApp, files } = loaded
  const decoded = decodeAppConfigObject(rawApp)
  if (!decoded.valid) {
    const error = new ConfigRejectedError(decoded.errors.join('\n'))
    // `files` even on a refusal: the save may have introduced a `$ref` the
    // watcher has to start following, and the file it introduced is the one the
    // operator is about to correct.
    //
    // The structured half comes from the SAME decode rather than being parsed
    // back out of the prose above — which is the point of the pipeline
    // returning both, and the only way the two can be guaranteed to describe
    // the same mistake.
    return {
      failure: refused(params, {
        files,
        phase: 'load',
        refusals: [],
        findings: decoded.findings,
        error,
      }),
    }
  }

  const anchor = await resolveConfigAnchor(filePath, rawApp)
  const verdict = classifyConfigChange(currentApp, decoded.app)
  announce(verdict)
  return { rawApp, files, app: decoded.app, anchor, verdict }
}

/** Rebuild the derived artifacts a reloaded config owns, and report success. */
const finishReload = async (
  params: ReloadServerParams,
  success: Omit<ReloadSuccess, 'ok'>
): Promise<ReloadSuccess> => {
  if (params.options.publicDir) {
    await rebuildSearchIndex(success.rawApp, params.options.publicDir)
  }
  return { ok: true, ...success }
}
