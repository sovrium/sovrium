/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { existsSync } from 'node:fs'
import { Effect, Layer, Semaphore } from 'effect'
import { DocumentRenderer } from '@/application/ports/services/document-renderer'
import { parseRendererEnv, type RendererConfig } from '@/domain/models/process-env/renderer'
import { gotenbergRenderer, inertRenderer, webviewRenderer } from './document-renderer-adapters'
import { detectChromePath } from './renderer-chrome-detect'
import {
  backendSource,
  chromeSandboxOff,
  holdProcessChrome,
  markProcessChromeStarted,
  type ChromeTarget,
} from './webview-lifecycle'
import type { Scope } from 'effect'

/**
 * The `DocumentRenderer` live layer ([internal ref] D2): reads `RENDERER_*` once,
 * picks the adapter, and owns the browser's lifetime (E3).
 *
 * ## One Chrome per process, started on first use
 *
 * Bun spawns (or connects to) ONE Chrome per process, on the first
 * `new Bun.WebView()`; every later view is a new target in it. Building this
 * layer starts nothing — the automation runtime is built on every boot, and an
 * operator who never renders a document must pay nothing. The first
 * render starts Chrome; each render opens a fresh view and closes it.
 *
 * The release step closes the browser. Because Chrome is per PROCESS and this
 * layer may be built by more than one runtime at once (two servers in one
 * process, a test harness) — and the browser driver uses the same
 * Chrome — the holders are counted and Chrome is closed only when the last one
 * releases (`webview-lifecycle.ts`). Renders queue behind ONE set of
 * `RENDERER_CONCURRENCY` permits per process, shared by every built layer, so
 * a second runtime cannot double the number of pages Chrome renders at once.
 *
 * ## Choosing the engine
 *
 * - `off`, an invalid env, or `puppeteer` (reserved, not shipped) → inert;
 * - `gotenberg` → its Chromium routes at `RENDERER_URL` (or `OFFICE_URL`);
 * - `webview`, or unset → `RENDERER_CDP_URL` (connect), else
 *   `RENDERER_CHROME_PATH` (spawn), else the user's installed Chrome or Edge;
 *   none of them → inert, naming the variables. Unset with no browser found is
 *   the honest "off", never a crash.
 */

/**
 * The process's render permits, shared by every built layer. Remade only when
 * `RENDERER_CONCURRENCY` reads differently (a test building layers from
 * different envs). Mutable on purpose: the one semaphore of the process.
 */
const processPermits: { semaphore?: Semaphore.Semaphore; count?: number } = {}

const permitsFor = (count: number): Semaphore.Semaphore => {
  if (processPermits.semaphore !== undefined && processPermits.count === count) {
    return processPermits.semaphore
  }
  const semaphore = Semaphore.makeUnsafe(count)
  processPermits.semaphore = semaphore
  processPermits.count = count
  return semaphore
}

const RENDERING_OFF =
  'HTML rendering is off (RENDERER_PROVIDER=off). Set RENDERER_PROVIDER=webview with RENDERER_CHROME_PATH (a local Chrome) or RENDERER_CDP_URL (a running Chrome), or RENDERER_PROVIDER=gotenberg with RENDERER_URL.'

const NO_BROWSER =
  'no Chrome, Chromium or Edge was found on this machine, so HTML rendering is off. Set RENDERER_CHROME_PATH to a Chrome executable or RENDERER_CDP_URL to a running Chrome (RENDERER_PROVIDER=webview), or RENDERER_PROVIDER=gotenberg with RENDERER_URL.'

const PUPPETEER_RESERVED =
  'RENDERER_PROVIDER=puppeteer is reserved and not shipped in this version. Use RENDERER_PROVIDER=webview with RENDERER_CHROME_PATH or RENDERER_CDP_URL.'

/** How to reach Chrome, or why HTML rendering is unavailable. */
export type WebviewTarget = ChromeTarget | { readonly kind: 'none'; readonly reason: string }

/** Pick the Chrome to drive. `exists` and `detect` are injected for tests. */
export const resolveWebviewTarget = (
  config: RendererConfig,
  exists: (path: string) => boolean = existsSync,
  detect: () => string | undefined = () => detectChromePath(process.platform, process.env)
): WebviewTarget => {
  if (config.cdpUrl !== undefined) return { kind: 'connect', cdpUrl: config.cdpUrl }
  if (config.chromePath !== undefined) {
    return exists(config.chromePath)
      ? { kind: 'spawn', path: config.chromePath }
      : {
          kind: 'none',
          reason: `RENDERER_CHROME_PATH=${config.chromePath} does not exist. Point it at a Chrome or Chromium executable, or set RENDERER_CDP_URL to a running Chrome.`,
        }
  }
  const detected = detect()
  return detected === undefined
    ? { kind: 'none', reason: NO_BROWSER }
    : { kind: 'spawn', path: detected }
}

/** Build the service for an env snapshot; the release closes Chrome when this was its last holder. */
export const makeDocumentRenderer = (
  env: Readonly<Record<string, string | undefined>>
): Effect.Effect<DocumentRenderer['Service'], never, Scope.Scope> =>
  Effect.gen(function* () {
    const parsed = parseRendererEnv(env)
    if (!parsed.ok) return inertRenderer(parsed.error)
    const { config } = parsed
    if (config.provider === 'off') return inertRenderer(RENDERING_OFF)
    if (config.provider === 'puppeteer') return inertRenderer(PUPPETEER_RESERVED)
    const permits = permitsFor(config.concurrency)
    if (config.provider === 'gotenberg') {
      return config.gotenbergUrl === undefined
        ? inertRenderer(
            'RENDERER_PROVIDER=gotenberg needs RENDERER_URL (or OFFICE_URL) set to the Gotenberg base URL.'
          )
        : gotenbergRenderer({ ...config, gotenbergUrl: config.gotenbergUrl }, permits)
    }
    const target = resolveWebviewTarget(config)
    if (target.kind === 'none') return inertRenderer(target.reason)
    yield* holdProcessChrome
    return webviewRenderer({
      config,
      backend: backendSource(target, config.timeoutMs, {
        sandboxOff: chromeSandboxOff(config.noSandbox === true),
      }),
      permits,
      onFirstView: markProcessChromeStarted,
    })
  })

/**
 * The live layer, reading `process.env` once when built. Construction does no
 * I/O beyond checking that a configured or detected executable exists.
 */
export const DocumentRendererLive = Layer.effect(
  DocumentRenderer,
  makeDocumentRenderer(process.env)
)
