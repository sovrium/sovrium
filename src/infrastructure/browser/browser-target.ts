/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { existsSync } from 'node:fs'
import { browserUnavailableMessage, type BrowserConfig } from '@/domain/models/process-env/browser'
import { detectChromePath } from '@/infrastructure/export/renderer-chrome-detect'

/**
 * Which browser a session runs on ([internal ref] D2), resolved once when the driver
 * is built:
 *
 * | Where                 | `auto`                                         | `webkit`             |
 * | --------------------- | ---------------------------------------------- | -------------------- |
 * | server, CI, Docker    | `BROWSER_CDP_URL`, else `BROWSER_CHROME_PATH`, else an installed Chrome; none → unavailable | refused at boot |
 * | desktop app, macOS    | an installed Chrome or Edge, else WebKit        | WebKit               |
 * | desktop app, elsewhere| an installed Chrome or Edge; none → unavailable | refused at boot      |
 */
export type BrowserTarget =
  | { readonly kind: 'connect'; readonly cdpUrl: string }
  | { readonly kind: 'spawn'; readonly path: string }
  | { readonly kind: 'webkit' }
  | { readonly kind: 'none'; readonly reason: string }

const NO_CHROME =
  'browser_unavailable: no Chrome, Chromium or Edge was found on this machine. Set BROWSER_CHROME_PATH to a Chrome executable, or BROWSER_CDP_URL to a running Chrome.'

/** The executable `BROWSER_CHROME_PATH` names, or why it cannot be used. */
const namedChrome = (path: string, exists: (path: string) => boolean): BrowserTarget =>
  exists(path)
    ? { kind: 'spawn', path }
    : {
        kind: 'none',
        reason: `browser_unavailable: BROWSER_CHROME_PATH=${path} does not exist. Point it at a Chrome or Chromium executable, or set BROWSER_CDP_URL to a running Chrome.`,
      }

/** No browser named: an installed Chrome, else WebKit in the desktop app on macOS. */
const foundBrowser = (
  config: BrowserConfig,
  platform: string,
  detected: string | undefined
): BrowserTarget => {
  if (detected !== undefined) return { kind: 'spawn', path: detected }
  const webkitFallback = config.backend === 'auto' && config.desktop && platform === 'darwin'
  return webkitFallback ? { kind: 'webkit' } : { kind: 'none', reason: NO_CHROME }
}

/** Pick the browser. `exists` and `detect` are injected for tests. */
export const resolveBrowserTarget = (
  config: BrowserConfig,
  platform: string = process.platform,
  exists: (path: string) => boolean = existsSync,
  detect: () => string | undefined = () => detectChromePath(process.platform, process.env)
): BrowserTarget => {
  if (config.provider === 'off') return { kind: 'none', reason: browserUnavailableMessage(config) }
  if (config.backend === 'webkit') return { kind: 'webkit' }
  if (config.cdpUrl !== undefined) return { kind: 'connect', cdpUrl: config.cdpUrl }
  if (config.chromePath !== undefined) return namedChrome(config.chromePath, exists)
  return foundBrowser(config, platform, detect())
}

/**
 * Why a browser agent may not run on `target`, or `undefined`.
 * The agent's promises — every request a page makes held to `allowedHosts`, every send held or refused — need request interception,
 * which WebKit does not have: a `browser/agent` step or a `browser.use` call
 * there is refused before any page opens. `browser/run` is not asked.
 */
export const agentBackendRefusal = (target: BrowserTarget): string | undefined =>
  target.kind === 'webkit'
    ? 'browser_backend_refused: the browser agent holds every request a page sends, and WebKit cannot hold one, so it does not run there. Install Chrome or Edge, or set BROWSER_BACKEND=chrome.'
    : undefined
