/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { resolveCdpWebSocketUrl } from './renderer-cdp-endpoint'
import type { Scope } from 'effect'

/**
 * The lifecycle of the process's one Chrome, shared by the two features that
 * drive it: the document renderer and the browser driver.
 *
 * Bun spawns (or connects to) ONE Chrome per process, on the first
 * `new Bun.WebView()`; every later view is a new target in it. So the pieces
 * below are per PROCESS, not per feature:
 *
 * - **the hold**: every built layer that may open a view holds the Chrome
 *   ({@link holdProcessChrome}); the last holder's release closes it, and only
 *   if a view ever started it ({@link markProcessChromeStarted});
 * - **the settle**: a view created in the same tick as a close attaches to the
 *   dying process, so the first view after a close waits a moment;
 * - **the backend**: how a view reaches Chrome — a spawned executable with the
 *   flags below, or a running one found over its DevTools endpoint
 *   ({@link backendSource});
 * - **the launch failure**: a sandboxed Chrome that dies as it starts on Linux
 *   gets the switch that usually fixes it ({@link sandboxLaunchHint});
 * - **the close**: a view is closed once, and a close that throws never
 *   replaces the outcome the caller already has ({@link closeView}).
 */

/** Holders of the process's Chrome, across every built layer. Mutable on purpose. */
const processChrome = { holders: 0, started: false, closedAt: 0 }

/**
 * How long a closed Chrome takes to be forgotten. A view created in the same
 * tick as `Bun.WebView.closeAll()` attaches to the dying process and fails with
 * "Chrome process closed the pipe" (measured; 20 ms later it spawns cleanly),
 * so the first view after a close waits this long.
 */
const CHROME_SETTLE_MS = 100

const settleAfterClose = async (): Promise<void> => {
  const wait = processChrome.closedAt + CHROME_SETTLE_MS - Date.now()
  if (wait > 0) await Bun.sleep(wait)
}

/**
 * Hold the process's Chrome for the life of the calling scope: the release
 * closes it when this was its last holder and a view started it.
 */
export const holdProcessChrome: Effect.Effect<void, never, Scope.Scope> = Effect.acquireRelease(
  Effect.sync(() => {
    processChrome.holders += 1
  }),
  () =>
    Effect.sync(() => {
      processChrome.holders -= 1
      if (processChrome.holders === 0 && processChrome.started) {
        processChrome.started = false
        processChrome.closedAt = Date.now()
        Bun.WebView.closeAll()
      }
    })
).pipe(Effect.asVoid)

/** Record that the process's Chrome was started, so the last release closes it. */
export const markProcessChromeStarted = (): void => {
  processChrome.started = true
}

/**
 * Whether the Chrome Sovrium spawns runs without its own sandbox: when the
 * operator asked for it (`RENDERER_NO_SANDBOX`, `BROWSER_NO_SANDBOX`), or as
 * root on Linux, where Chrome refuses to start with it. Never inferred from
 * anything else: a host where the sandbox cannot start gets a launch failure
 * that names the switch ({@link sandboxLaunchHint}), not a silently weaker
 * browser.
 */
export const chromeSandboxOff = (
  noSandbox: boolean,
  platform: NodeJS.Platform = process.platform,
  uid: number | undefined = process.getuid?.()
): boolean => noSandbox || (platform === 'linux' && uid === 0)

/** The variable family a feature configures its Chrome with. */
export type ChromeEnvPrefix = 'RENDERER' | 'BROWSER'

/** What an operator can do about a Chrome that stopped as it started. */
export const sandboxLaunchHint = (prefix: ChromeEnvPrefix): string =>
  `Chrome stopped as it started. On Linux this is usually its sandbox failing to start, as for a user without root and without user namespaces (a hardened systemd unit, a container). Set ${prefix}_NO_SANDBOX=1 to start Chrome without its sandbox, or run Chrome as a separate service and set ${prefix}_CDP_URL.`

/** A launch failure of a sandboxed Chrome on Linux, with the switch that may fix it. */
export const explainLaunchFailure = (
  message: string,
  sandboxOff: boolean,
  platform: NodeJS.Platform = process.platform,
  prefix: ChromeEnvPrefix = 'RENDERER'
): string =>
  !sandboxOff && platform === 'linux' && message.includes('closed the pipe')
    ? `${message}. ${sandboxLaunchHint(prefix)}`
    : message

/**
 * Chrome flags appended to Bun's defaults. Without its own sandbox
 * ({@link chromeSandboxOff}) the page is still held by the request
 * interception; the sandbox is the second wall, against a flaw in Chrome
 * itself. `--dns-prefetch-disable` stops the name lookups Chrome makes on its
 * own, outside the request interception. The WebRTC policy gathers no ICE
 * candidate without a proxy: a page then reads no address of the host and sends
 * no STUN request, both outside the interception. Full Chrome reads the first
 * switch and the headless shell the second, so both are set (measured on each:
 * four candidates, two of them the host's public addresses, without; none with).
 */
const chromeArgv = (sandboxOff: boolean): string[] => [
  '--hide-scrollbars',
  '--dns-prefetch-disable',
  '--webrtc-ip-handling-policy=disable_non_proxied_udp',
  '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  '--mute-audio',
  ...(sandboxOff ? ['--no-sandbox'] : []),
]

/** A Chrome a view can reach: a running one to connect to, or an executable to spawn. */
export type ChromeTarget =
  | { readonly kind: 'connect'; readonly cdpUrl: string }
  | { readonly kind: 'spawn'; readonly path: string }

/**
 * The backend of every view, produced once per view; a failure means Chrome is
 * unreachable. `invalidate` forgets a memoised connect address after a view
 * that could not use it, so a restarted sidecar is found again. `explain` adds
 * what the operator can do to a failed launch's message.
 */
export interface BackendSource {
  /** Finds the backend; a discovery it runs is bounded by `budgetMs` when given. */
  readonly acquire: (budgetMs?: number) => Promise<Bun.WebView.Backend>
  readonly invalidate: () => void
  readonly explain?: (message: string) => string
}

/** How {@link backendSource} reaches and starts Chrome; every field has a default. */
export interface BackendSourceOptions {
  /** Finds a running Chrome's WebSocket address from its DevTools URL (injected for tests). */
  readonly resolveUrl?: (cdpUrl: string, budgetMs: number) => Promise<string>
  /** Start a spawned Chrome without its own sandbox ({@link chromeSandboxOff}). */
  readonly sandboxOff?: boolean
  /** The variables a launch failure names. */
  readonly prefix?: ChromeEnvPrefix
}

/**
 * The backend source for `target`. A connect address is resolved on first use
 * and reused; a failed discovery, or a view that failed on the address (a
 * restarted sidecar answers on another IP), makes the next view resolve it
 * again. Every acquire waits out a recent close of the process's Chrome.
 */
export const backendSource = (
  target: ChromeTarget,
  timeoutMs: number,
  options: BackendSourceOptions = {}
): BackendSource => {
  const {
    resolveUrl = (cdpUrl, budgetMs) => resolveCdpWebSocketUrl(cdpUrl, { timeoutMs: budgetMs }),
    sandboxOff = false,
    prefix = 'RENDERER',
  } = options
  if (target.kind === 'spawn') {
    const backend: Bun.WebView.Backend = {
      type: 'chrome',
      path: target.path,
      url: false,
      argv: chromeArgv(sandboxOff),
    }
    return {
      acquire: async () => {
        await settleAfterClose()
        return backend
      },
      invalidate: () => undefined,
      explain: (message) => explainLaunchFailure(message, sandboxOff, process.platform, prefix),
    }
  }
  // Mutable on purpose: the memoised address, until a failure forgets it.
  const cache: { url?: Promise<string> } = {}
  return {
    acquire: async (budgetMs = timeoutMs) => {
      const pending = cache.url ?? resolveUrl(target.cdpUrl, Math.min(budgetMs, timeoutMs))
      cache.url = pending
      await settleAfterClose()
      const url = await pending.catch((error: unknown) => {
        delete cache.url
        throw error
      })
      return { type: 'chrome', url }
    },
    invalidate: () => {
      delete cache.url
    },
  }
}

/**
 * Close `view`, ignoring a close that throws. It runs after the caller already
 * has its outcome, and letting a teardown error about a view nobody uses any
 * more escape would replace that outcome.
 */
export const closeView = (view: Bun.WebView): void => {
  try {
    view.close()
  } catch {
    // Already closed by Chrome, or the process went away: nothing to release.
  }
}

/** Close `view` the first time this is called, and never again (a deadline and a `finally` may both ask). */
export const closeViewOnce = (view: Bun.WebView): (() => void) => {
  // Mutable on purpose: whether the one close already ran.
  const state = { closed: false }
  return () => {
    if (state.closed) return
    state.closed = true
    closeView(view)
  }
}
