/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { RENDER_DOCUMENT_ORIGIN } from '@/application/ports/services/document-renderer'
import { imageAreaRefusal, toPrintToPdfParams } from './renderer-page-setup'
import { decideInterception, interceptionCommand } from './renderer-request-interception'
import { closeViewOnce } from './webview-lifecycle'
import type {
  ImageRenderOptions,
  PdfPageSetup,
  RenderSandboxOptions,
} from '@/application/ports/services/document-renderer'

/**
 * One sandboxed render on a `Bun.WebView` with the Chrome backend ([internal ref] D2,
 * D8): a FRESH view, closed afterwards whatever happens.
 *
 * Order matters, and each step is load-bearing:
 *
 * 1. `about:blank` first — Bun opens the view's CDP session on the first
 *    navigation, and no `cdp()` call works before it.
 * 2. Script execution off (`Emulation.setScriptExecutionDisabled`); the
 *    document also carries a `script-src 'none'` CSP. Either alone stops an
 *    inline script; both are kept.
 * 3. `Fetch.enable` on `*`, so every later request pauses and is answered by
 *    `decideInterception` — before Chrome resolves a name or opens a socket.
 * 4. Navigate to the synthetic document URL, fulfilled with the HTML.
 * 5. The idle wait Chrome does not offer: `document.fonts.ready`, then no
 *    paused request in flight for {@link QUIET_MS}. Every request goes through
 *    the interception, so the in-flight count is exact rather than sampled.
 * 6. Capture (`Page.printToPDF` or `Page.captureScreenshot`).
 *
 * The deadline ABORTS: when it fires the view is closed, which rejects every
 * pending operation, the idle wait stops polling, and the render reports
 * {@link RenderDeadlineExceeded}. The view is closed exactly once, so a close
 * that throws never replaces the error the render ended with.
 */

/** The network is idle once no request has been in flight for this long. */
const QUIET_MS = 50

/** A remote asset fetched under `allowRemoteAssets` may weigh at most this. */
const REMOTE_ASSET_MAX_BYTES = 10 * 1024 * 1024

/** Thrown when the deadline closed the view; the live layer maps it to `render_timeout`. */
export class RenderDeadlineExceeded extends Error {
  constructor(readonly timeoutMs: number) {
    super(`the render outlasted ${String(timeoutMs)} ms`)
  }
}

/** Thrown when the requested element is not on the page. */
export class RenderSelectorMissing extends Error {}

/** Thrown before a capture whose image would exceed the pixel limits; mapped to `render_limit_exceeded`. */
export class RenderAreaExceeded extends Error {}

/** Whether the render's deadline has fired. Mutable on purpose: the timer sets it. */
interface Deadline {
  fired: boolean
}

interface SessionInput<T> {
  readonly backend: Bun.WebView.Backend
  readonly html: string
  readonly sandbox: RenderSandboxOptions
  readonly timeoutMs: number
  readonly viewport?: { readonly width: number; readonly height: number; readonly scale: number }
  readonly capture: (view: Bun.WebView) => Promise<T>
}

/** The part of a CDP `Fetch.requestPaused` event the interception reads. */
interface PausedRequest {
  readonly requestId: string
  readonly request: { readonly url: string }
}

/** The paused request a CDP event carries, read without a cast. */
const pausedRequestOf = (event: Event): PausedRequest | undefined => {
  const data: unknown = 'data' in event ? event.data : undefined
  if (typeof data !== 'object' || data === null) return undefined
  const { requestId, request } = data as {
    readonly requestId?: unknown
    readonly request?: unknown
  }
  if (typeof requestId !== 'string' || typeof request !== 'object' || request === null) {
    return undefined
  }
  const { url } = request as { readonly url?: unknown }
  return typeof url === 'string' ? { requestId, request: { url } } : undefined
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** Answers every paused request and tracks how many are in flight. */
const interceptRequests = (
  view: Bun.WebView,
  input: SessionInput<unknown>,
  documentUrl: string
): { readonly isQuiet: () => boolean } => {
  // Mutable on purpose: the in-flight count of an event stream.
  const state = { inFlight: 0, lastActivity: Date.now() }
  // One CDP command at a time: two paused requests answered concurrently leave
  // the second answer unresolved, so the render waits for a quiet that never
  // comes. Mutable on purpose: the tail of the command chain.
  const commands = { tail: Promise.resolve() as Promise<unknown> }
  const context = {
    documentUrl,
    sandbox: input.sandbox,
    remoteTimeoutMs: input.timeoutMs,
    remoteMaxBytes: REMOTE_ASSET_MAX_BYTES,
  }
  view.addEventListener('Fetch.requestPaused', (event: Event) => {
    const paused = pausedRequestOf(event)
    if (paused === undefined) return
    state.inFlight += 1
    state.lastActivity = Date.now()
    const { requestId, request } = paused
    void decideInterception(request.url, context)
      .then((decision) => {
        const command = interceptionCommand(requestId, decision, input.html)
        const sent = commands.tail.then(() => view.cdp(command.method, command.params))
        commands.tail = sent.catch(() => undefined)
        return sent
      })
      // A view closed mid-request (the deadline) rejects here; nothing to answer any more.
      .catch(() => undefined)
      .finally(() => {
        state.inFlight -= 1
        state.lastActivity = Date.now()
      })
  })
  return { isQuiet: () => state.inFlight === 0 && Date.now() - state.lastActivity >= QUIET_MS }
}

/**
 * Poll until the network is quiet, or the deadline fires. A request whose
 * answer never comes (a resolver that never settles) keeps the count above
 * zero for ever, so the deadline is what ends the wait, not the count.
 */
const waitForQuiet = async (
  isQuiet: () => boolean,
  deadline: Readonly<Deadline>,
  timeoutMs: number
): Promise<void> => {
  if (deadline.fired) throw new RenderDeadlineExceeded(timeoutMs)
  if (isQuiet()) return
  await sleep(QUIET_MS / 5)
  return waitForQuiet(isQuiet, deadline, timeoutMs)
}

const loadSandboxed = async <T>(
  view: Bun.WebView,
  input: SessionInput<T>,
  deadline: Readonly<Deadline>
): Promise<T> => {
  await view.navigate('about:blank')
  await view.cdp('Emulation.setScriptExecutionDisabled', { value: true })
  if (input.viewport !== undefined) {
    await view.cdp('Emulation.setDeviceMetricsOverride', {
      width: input.viewport.width,
      height: input.viewport.height,
      deviceScaleFactor: input.viewport.scale,
      mobile: false,
    })
  }
  const documentUrl = `${RENDER_DOCUMENT_ORIGIN}/document.html`
  const network = interceptRequests(view, input, documentUrl)
  await view.cdp('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] })
  await view.navigate(documentUrl)
  await view.evaluate('document.fonts.ready.then(() => true)')
  await waitForQuiet(network.isQuiet, deadline, input.timeoutMs)
  return input.capture(view)
}

/** Run one render on a fresh view under the deadline; the view is always closed. */
export const runSandboxedRender = async <T>(input: SessionInput<T>): Promise<T> => {
  const view = new Bun.WebView({
    backend: input.backend,
    width: input.viewport?.width ?? 1280,
    height: input.viewport?.height ?? 800,
    dataStore: 'ephemeral',
  })
  const deadline: Deadline = { fired: false }
  const closeOnce = closeViewOnce(view)
  const timer = setTimeout(() => {
    deadline.fired = true
    closeOnce()
  }, input.timeoutMs)
  try {
    const result = await loadSandboxed(view, input, deadline)
    if (deadline.fired) throw new RenderDeadlineExceeded(input.timeoutMs)
    return result
  } catch (error) {
    throw deadline.fired ? new RenderDeadlineExceeded(input.timeoutMs) : error
  } finally {
    clearTimeout(timer)
    closeOnce()
  }
}

/** Print the loaded page to PDF bytes. */
export const capturePdf =
  (setup: PdfPageSetup) =>
  async (view: Bun.WebView): Promise<Uint8Array> => {
    const { data } = await view.cdp<{ readonly data: string }>(
      'Page.printToPDF',
      toPrintToPdfParams(setup)
    )
    return new Uint8Array(Buffer.from(data, 'base64'))
  }

interface Clip {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** The border box of the first element matching `selector`, in page CSS pixels. */
const selectorClip = async (view: Bun.WebView, selector: string): Promise<Clip> => {
  const { root } = await view.cdp<{ readonly root: { readonly nodeId: number } }>(
    'DOM.getDocument',
    { depth: 0 }
  )
  const { nodeId } = await view.cdp<{ readonly nodeId: number }>('DOM.querySelector', {
    nodeId: root.nodeId,
    selector,
  })
  if (nodeId === 0) throw new RenderSelectorMissing(`no element matches the selector ${selector}`)
  const { model } = await view.cdp<{ readonly model: { readonly border: readonly number[] } }>(
    'DOM.getBoxModel',
    { nodeId }
  )
  const xs = model.border.filter((_, i) => i % 2 === 0)
  const ys = model.border.filter((_, i) => i % 2 === 1)
  const [x, y] = [Math.min(...xs), Math.min(...ys)]
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

/**
 * The whole content when no height is given, else exactly the viewport. The
 * content height is measured, so it is checked against the pixel limits
 * before anything is captured.
 */
const pageClip = async (view: Bun.WebView, options: ImageRenderOptions): Promise<Clip> => {
  if (options.height !== undefined) {
    return { x: 0, y: 0, width: options.width, height: options.height }
  }
  const metrics = await view.cdp<{ readonly cssContentSize: { readonly height: number } }>(
    'Page.getLayoutMetrics'
  )
  return { x: 0, y: 0, width: options.width, height: Math.ceil(metrics.cssContentSize.height) }
}

/** Screenshot the loaded page; resolves the bytes and the pixel size. */
export const captureImage =
  (options: ImageRenderOptions) =>
  async (
    view: Bun.WebView
  ): Promise<{ readonly bytes: Uint8Array; readonly width: number; readonly height: number }> => {
    if (options.transparent === true) {
      await view.cdp('Emulation.setDefaultBackgroundColorOverride', {
        color: { r: 0, g: 0, b: 0, a: 0 },
      })
    }
    const clip =
      options.selector === undefined
        ? await pageClip(view, options)
        : await selectorClip(view, options.selector)
    const refusal = imageAreaRefusal({ ...clip, scale: options.scale ?? 1 })
    if (refusal !== undefined) throw new RenderAreaExceeded(refusal)
    const format = options.format ?? 'png'
    const { data } = await view.cdp<{ readonly data: string }>('Page.captureScreenshot', {
      format,
      ...(format !== 'png' && options.quality !== undefined ? { quality: options.quality } : {}),
      clip: { ...clip, scale: 1 },
      captureBeyondViewport: true,
      fromSurface: true,
    })
    const scale = options.scale ?? 1
    return {
      bytes: new Uint8Array(Buffer.from(data, 'base64')),
      width: Math.round(clip.width * scale),
      height: Math.round(clip.height * scale),
    }
  }
