/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Data, Duration, Effect, Layer } from 'effect'
import { PageMeasure, type PageMeasureFile } from '@/application/ports/services/page-measure'
import { parseRendererEnv } from '@/domain/models/process-env/renderer'
import { detectChromePath } from '@/infrastructure/export/renderer-chrome-detect'
import {
  backendSource,
  chromeSandboxOff,
  closeView,
  holdProcessChrome,
  markProcessChromeStarted,
  type BackendSource,
} from '@/infrastructure/export/webview-lifecycle'
import type { Scope } from 'effect'

/** The documents could not be laid out on this machine. */
class PageMeasureError extends Data.TaggedError('PageMeasureError')<{ readonly cause: unknown }> {}

/** How long laying every document out may take before the caller estimates instead. */
const MEASURE_TIMEOUT = Duration.seconds(60)

/** The viewport height the documents are laid out under; only their width shapes them. */
const VIEWPORT_HEIGHT = 720

/** The height of the body once the fonts it names are loaded. */
const BODY_HEIGHT =
  'document.fonts.ready.then(() => Math.ceil(document.body.getBoundingClientRect().height))'

/**
 * The policy every measured document is laid out under: its own files and
 * inline styles, nothing else. A drawn page keeps the `https://` source of an
 * image its config names, and a measure is not a reason to fetch it — it would
 * hand the operator's address to that site, or reach a host on their network.
 * Script is off too: a board draws statically. Measured on WebKit and on the
 * Chrome headless shell: with this policy the page sends no request at all.
 */
export const MEASURE_CSP =
  "default-src 'none'; script-src 'none'; img-src file: data: blob:; style-src file: 'unsafe-inline'; font-src file: data:"

const POLICY = `<meta http-equiv="Content-Security-Policy" content="${MEASURE_CSP}">`

/** `html` with {@link MEASURE_CSP} declared first in its head, before anything it loads. */
export const offlineDocument = (html: string): string => {
  const head = /<head\b[^>]*>/i.exec(html)
  if (head === null) return `${POLICY}\n${html}`
  const at = head.index + head[0].length
  return `${html.slice(0, at)}\n${POLICY}${html.slice(at)}`
}

/**
 * Which engine lays the documents out: the system WebKit on macOS; elsewhere
 * an installed Chrome, Chromium or Edge, found by path and always SPAWNED —
 * never Bun's auto-connect, which would attach to the user's own browser
 * (see `renderer-chrome-detect.ts`). `undefined`: none on this machine.
 */
export const measureEngineOf = (
  platform: NodeJS.Platform,
  env: Readonly<Record<string, string | undefined>>,
  exists?: (path: string) => boolean
): 'webkit' | { readonly chrome: string } | undefined => {
  if (platform === 'darwin') return 'webkit'
  const path = detectChromePath(platform, env, exists)
  return path === undefined ? undefined : { chrome: path }
}

/**
 * Whether the Chrome the measure spawns runs without its own sandbox: on the
 * document renderer's switch, `RENDERER_NO_SANDBOX`, read through the same
 * parser — a host where Chrome cannot create its sandbox cannot measure a page
 * either — or as root on Linux ({@link chromeSandboxOff}). An invalid
 * `RENDERER_*` env keeps the sandbox on; the renderer reports it.
 */
export const measureSandboxOff = (
  env: Readonly<Record<string, string | undefined>>,
  platform?: NodeJS.Platform,
  uid?: number
): boolean => {
  const parsed = parseRendererEnv(env)
  return chromeSandboxOff(parsed.ok && parsed.config.noSandbox === true, platform, uid)
}

const failure = (cause: unknown) => new PageMeasureError({ cause })

/** A scratch directory holding every file, removed when the scope closes, however it closes. */
const scratchWith = (input: {
  readonly files: readonly PageMeasureFile[]
  readonly documents: readonly string[]
}): Effect.Effect<string, PageMeasureError, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.tryPromise({
      try: () => mkdtemp(join(tmpdir(), 'sovrium-page-measure-')),
      catch: failure,
    }),
    (dir) =>
      Effect.tryPromise({
        try: () => rm(dir, { recursive: true, force: true }),
        catch: failure,
      }).pipe(
        Effect.tapCause((cause) =>
          Effect.logWarning(`[design-system] a scratch directory was left at ${dir}`, cause)
        ),
        // Swallowed on purpose: the heights are already measured, and a stray
        // directory under the system temp must not fail the export.
        Effect.ignore
      )
  ).pipe(
    Effect.tap((dir) =>
      Effect.tryPromise({
        try: () =>
          Promise.all(
            input.files.map(async (file) => {
              const target = join(dir, file.path)
              await mkdir(dirname(target), { recursive: true })
              await writeFile(
                target,
                input.documents.includes(file.path)
                  ? offlineDocument(new TextDecoder().decode(file.bytes))
                  : file.bytes
              )
            })
          ),
        catch: failure,
      })
    )
  )

/** One view for the measure, closed when the scope closes: a timeout's interruption included. */
const viewOn = (
  backend: Bun.WebView.Backend,
  width: number
): Effect.Effect<Bun.WebView, PageMeasureError, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.try({
      try: () =>
        new Bun.WebView({ backend, width, height: VIEWPORT_HEIGHT, dataStore: 'ephemeral' }),
      catch: failure,
    }),
    (view) => Effect.sync(() => closeView(view))
  )

/** The height of `document` in `dir`, drawn in `view`. */
const heightOf = (view: Bun.WebView, dir: string, document: string) =>
  Effect.tryPromise({
    try: async () => {
      await view.navigate(pathToFileURL(join(dir, document)).href)
      const height = Number(await view.evaluate(BODY_HEIGHT))
      return Number.isFinite(height) ? height : undefined
    },
    catch: failure,
  })

/**
 * Lay each document out from a scratch directory holding every file, read
 * through `file://` as a designer opening the bundle would, under
 * {@link MEASURE_CSP}: nothing a document names leaves the machine.
 */
const measureWith = (
  engine: 'webkit' | BackendSource,
  input: Parameters<PageMeasure['Service']['drawnHeights']>[0]
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const dir = yield* scratchWith(input)
      const backend =
        engine === 'webkit'
          ? ('webkit' as const)
          : yield* Effect.tryPromise({ try: () => engine.acquire(), catch: failure })
      if (engine !== 'webkit') markProcessChromeStarted()
      const view = yield* viewOn(backend, input.width)
      // One view, one document at a time: a view draws one page.
      return yield* Effect.forEach(input.documents, (document) => heightOf(view, dir, document))
    })
  )

const unmeasured = (documents: readonly string[]) => documents.map(() => undefined)

/**
 * The page measure, laid out by the runtime's own browser engine. A machine
 * with none measures nothing, and the caller estimates every height.
 */
const makePageMeasure = (
  env: Readonly<Record<string, string | undefined>>
): Effect.Effect<PageMeasure['Service'], never, Scope.Scope> =>
  Effect.gen(function* () {
    const found = measureEngineOf(process.platform, env)
    if (found !== undefined && found !== 'webkit') yield* holdProcessChrome
    const engine =
      found === undefined || found === 'webkit'
        ? found
        : backendSource({ kind: 'spawn', path: found.chrome }, Duration.toMillis(MEASURE_TIMEOUT), {
            sandboxOff: measureSandboxOff(env),
          })
    return PageMeasure.of({
      drawnHeights: (input) =>
        engine === undefined
          ? Effect.succeed(unmeasured(input.documents))
          : measureWith(engine, input).pipe(
              Effect.timeout(MEASURE_TIMEOUT),
              Effect.tapCause((cause) =>
                Effect.logWarning('[design-system] the drawn pages could not be measured', cause)
              ),
              // Swallowed on purpose: an engine that fails or outlasts the
              // timeout still lets the export finish, the caller estimating
              // each height instead. The timeout interrupts the scope, which
              // closes the view and removes the scratch directory.
              Effect.orElseSucceed(() => unmeasured(input.documents)),
              Effect.withSpan('page-measure.drawn-heights')
            ),
    })
  })

/** The live layer, reading `process.env` once when built. */
export const PageMeasureLive = Layer.effect(PageMeasure, makePageMeasure(process.env))
