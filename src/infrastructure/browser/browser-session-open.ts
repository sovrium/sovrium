/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { closeView, sandboxLaunchHint } from '@/infrastructure/export/webview-lifecycle'
import { logError } from '@/infrastructure/logging/logger'
import { isSsrfRelaxed } from '@/infrastructure/process/security-posture'
import { cdpQueue, messageOf, StepError, withDeadline, type CdpSend } from './browser-cdp'
import { failHeld } from './browser-page-gate'
import {
  attachChromeListeners,
  enableChromeGuard,
  newPageState,
  type PageState,
} from './browser-page-state'
import type { BrowserSendGate } from '@/application/ports/services/browser-driver'

/**
 * Opening one browser session ([internal ref] D3–D5).
 *
 * CHROME. A fresh view in the process's one Chrome. Its first navigation
 * (`about:blank`) opens the CDP session; the listeners are attached before it,
 * the guard is switched on right after it, and the cookie jar — shared by every
 * view of the process — is cleared, then given the stored session's cookies.
 *
 * WEBKIT (desktop app, macOS). A view on the session's own data directory under
 * the data dir, `browser-sessions/<digest>` (mode 0700), which keeps its
 * cookies across runs; an unnamed session is ephemeral. WebKit answers dialogs
 * itself and has no request interception: the guard there is the check of
 * every address the run opens or ends on.
 */

/** The viewport every session gets. */
const VIEWPORT = { width: 1280, height: 800 } as const

/** How long opening the view and its first page may take. */
const OPEN_TIMEOUT_MS = 60_000

/** What a Chrome session is opened with. */
export interface ChromeOpenInput {
  readonly backend: Bun.WebView.Backend
  readonly allowedHosts: readonly string[]
  readonly cookies: string | undefined
  readonly sendGate: BrowserSendGate | undefined
  readonly onFirstView: () => void
}

/** The cookies a stored jar holds, in the shape `Network.setCookies` takes. */
const cookiesOf = (jar: string | undefined): unknown[] => {
  if (jar === undefined) return []
  try {
    const parsed: unknown = JSON.parse(jar)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** The local-network permissions Chrome asks a page for before it reaches a private address. */
const LOCAL_NETWORK_PERMISSIONS = ['localNetworkAccess', 'localNetwork', 'loopbackNetwork'] as const

/**
 * Let the pages of `allowedHosts` reach each other without Chrome's local
 * network prompt, which a headless browser can never answer. This lifts no
 * guard: the browser guard has already decided every request — a private
 * address passes it only when the operator allows private outbound calls —
 * and a permission name this Chrome does not know is skipped. Without that
 * allowance nothing is granted, so Chrome's own check still stops a public
 * page whose host name comes to resolve to a private address.
 */
const grantLocalNetwork = async (send: CdpSend, allowedHosts: readonly string[]) => {
  if (!isSsrfRelaxed()) return
  const origins = allowedHosts.flatMap((host) =>
    host.startsWith('*.') ? [] : [`http://${host}`, `https://${host}`]
  )
  await Promise.all(
    origins.flatMap((origin) =>
      LOCAL_NETWORK_PERMISSIONS.map((name) =>
        // Swallowed: Chrome rejects a permission name it does not know, and the three
        // names cover several Chrome versions. A grant that fails for any other reason
        // leaves Chrome's own prompt in place, so the request is blocked, never widened.
        send('Browser.grantPermissions', { permissions: [name], origin }).catch(() => undefined)
      )
    )
  )
}

/** Open a Chrome session, guarded from its first request. */
export const openChromeSession = async (input: ChromeOpenInput): Promise<PageState> => {
  const view = new Bun.WebView({ backend: input.backend, ...VIEWPORT, dataStore: 'ephemeral' })
  const send = cdpQueue(view)
  const state = newPageState(view, send, input.allowedHosts, input.sendGate)
  attachChromeListeners(state, send)
  try {
    await withDeadline(view.navigate('about:blank'), OPEN_TIMEOUT_MS, 'the browser')
    input.onFirstView()
    await enableChromeGuard(state, send)
    await grantLocalNetwork(send, input.allowedHosts)
    // The jar is shared by every view of the process, and a remote browser keeps
    // it across Sovrium processes: cleared, then given this session's cookies.
    await send('Network.clearBrowserCookies')
    const cookies = cookiesOf(input.cookies)
    if (cookies.length > 0) await send('Network.setCookies', { cookies })
    return state
  } catch (error) {
    // Whatever the open got to — a permission granted, cookies set — is undone
    // as on any close, so a half-opened session leaves nothing to the next one.
    await closeSession(state)
    throw error
  }
}

/** The directory a named WebKit session keeps its cookies in. */
const webkitStoreDir = (dataDir: string, sessionName: string): string => {
  const digest = new Bun.CryptoHasher('sha256').update(sessionName).digest('hex').slice(0, 32)
  const dir = join(dataDir, 'browser-sessions', digest)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  return dir
}

/** Open a WebKit session (desktop app, macOS). */
export const openWebkitSession = async (input: {
  readonly allowedHosts: readonly string[]
  readonly sessionName: string | undefined
  readonly dataDir: string
}): Promise<PageState> => {
  const dataStore =
    input.sessionName === undefined
      ? ('ephemeral' as const)
      : { directory: webkitStoreDir(input.dataDir, input.sessionName) }
  const view = new Bun.WebView({ backend: 'webkit', ...VIEWPORT, dataStore })
  const state = newPageState(view, undefined, input.allowedHosts)
  try {
    await withDeadline(view.navigate('about:blank'), OPEN_TIMEOUT_MS, 'the browser')
    return state
  } catch (error) {
    state.closed = true
    closeView(view)
    throw error
  }
}

/**
 * The step error a failed launch becomes: `browser_launch_failed`, with the
 * switch that usually fixes it.
 */
export const launchFailure = (error: unknown): StepError =>
  new StepError(
    'browser_launch_failed',
    `browser_launch_failed: the browser could not be started (${messageOf(error)}). ${sandboxLaunchHint('BROWSER')}`
  )

/**
 * Close a session: on Chrome every send the submission gate still holds is
 * failed, then the shared jar is cleared, so nothing leaves and the next run
 * starts signed out ([internal ref] D4). Never throws.
 */
export const closeSession = async (state: PageState): Promise<void> => {
  if (state.closed) return
  if (state.send !== undefined) {
    await failHeld(state)
    // Never throws: a close runs on every way a run ends. The next open clears the jar
    // again and fails if it cannot, so a cookie left here never reaches another run;
    // it is logged because a remote browser keeps it until then.
    await state.send('Network.clearBrowserCookies', undefined, 2000).catch((error: unknown) => {
      logError('[browser] clearing the cookies on close failed', error)
    })
    // Swallowed: the permissions are granted per open and reset again by the next one.
    await state.send('Browser.resetPermissions', undefined, 2000).catch(() => undefined)
  }
  state.closed = true
  closeView(state.view)
}

/** The Chrome jar, serialised for the session store. */
export const exportJar = async (state: PageState): Promise<string | undefined> => {
  if (state.send === undefined) return undefined
  const { cookies } = await state.send<{ cookies: Record<string, unknown>[] }>(
    'Network.getAllCookies'
  )
  const kept = cookies.map((cookie) =>
    Object.fromEntries(
      Object.entries(cookie).filter(([key]) =>
        ['name', 'value', 'domain', 'path', 'secure', 'httpOnly', 'sameSite', 'expires'].includes(
          key
        )
      )
    )
  )
  return JSON.stringify(kept)
}
