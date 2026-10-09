/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  DocumentRenderer,
  RenderFailedError,
  RenderLimitExceededError,
  RenderTimeoutError,
  RendererUnavailableError,
  type DocumentRenderError,
  type RenderedImage,
  type RenderedPdf,
  type RenderImageFormat,
} from '@/application/ports/services/document-renderer'
import { redactConnectionUrl } from '@/domain/kernel/sanitize/redact-connection-url'
import { renderLimitRefusal, type RendererConfig } from '@/domain/models/process-env/renderer'
import { postGotenbergForm, type GotenbergFile } from './gotenberg-client'
import { gotenbergImageForm, gotenbergPdfForm } from './gotenberg-renderer'
import { BackendUnreachable, renderWithinBudget } from './renderer-launch-retry'
import { imageAreaRefusal, readPdfPageCount } from './renderer-page-setup'
import { outboundGuardAccepts, stripRemoteReferences } from './renderer-request-interception'
import {
  RenderAreaExceeded,
  RenderDeadlineExceeded,
  captureImage,
  capturePdf,
  runSandboxedRender,
} from './webview-renderer'
import type { Semaphore } from 'effect'

/**
 * The two working `DocumentRenderer` services — `webview` and `gotenberg` —
 * and the inert one. Provider selection and the resource lifetime are
 * `document-renderer-live.ts`'s; this file turns a configured engine into the
 * port, with the limits and the error vocabulary every adapter shares.
 */

type Service = DocumentRenderer['Service']

export const unavailable = (message: string): RendererUnavailableError =>
  new RendererUnavailableError({
    code: 'renderer_unavailable',
    message: `renderer_unavailable: ${message}`,
  })

const failed = (message: string, cause?: unknown): RenderFailedError =>
  new RenderFailedError({ code: 'render_failed', message: `render_failed: ${message}`, cause })

const timedOut = (timeoutMs: number): RenderTimeoutError =>
  new RenderTimeoutError({
    code: 'render_timeout',
    timeoutMs,
    message: `render_timeout: the render took longer than ${String(timeoutMs)} ms (RENDERER_TIMEOUT_MS)`,
  })

const overLimit = (reason: string): RenderLimitExceededError =>
  new RenderLimitExceededError({
    code: 'render_limit_exceeded',
    message: `render_limit_exceeded: ${reason}`,
  })

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** A service that refuses every render with one reason. */
export const inertRenderer = (message: string): Service =>
  DocumentRenderer.of({
    provider: 'off',
    renderPdf: () => Effect.fail(unavailable(message)),
    renderImage: () => Effect.fail(unavailable(message)),
  })

const CONTENT_TYPES: Readonly<Record<RenderImageFormat, RenderedImage['contentType']>> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

const limited = (
  config: RendererConfig,
  bytes: number,
  pages?: number
): Effect.Effect<void, RenderLimitExceededError> => {
  const refusal = renderLimitRefusal(config, { bytes, ...(pages === undefined ? {} : { pages }) })
  return refusal === undefined ? Effect.void : Effect.fail(overLimit(refusal))
}

/** A PDF's bytes, checked: a real page count, then both limits. */
const checkedPdf = (
  config: RendererConfig,
  bytes: Uint8Array
): Effect.Effect<RenderedPdf, DocumentRenderError> =>
  Effect.tryPromise({
    try: () => readPdfPageCount(bytes),
    catch: (error): DocumentRenderError => failed(describe(error), error),
  }).pipe(
    Effect.flatMap((pages): Effect.Effect<RenderedPdf, DocumentRenderError> =>
      pages === 0
        ? Effect.fail(failed('the engine returned no readable PDF'))
        : limited(config, bytes.length, pages).pipe(
            Effect.as({
              bytes,
              contentType: 'application/pdf' as const,
              pages,
              size: bytes.length,
            })
          )
    )
  )

/** The declared image size, refused before any engine is asked when it exceeds the pixel limits. */
const declaredAreaFits = (area: {
  readonly width: number
  readonly height: number
  readonly scale: number
}): Effect.Effect<void, RenderLimitExceededError> => {
  const refusal = imageAreaRefusal(area)
  return refusal === undefined ? Effect.void : Effect.fail(overLimit(refusal))
}

/**
 * The browser backend, produced once per render; a failure means the engine
 * is unreachable. `invalidate` forgets a memoised connect address after a
 * render that could not use it, so a restarted sidecar is found again.
 * `explain` adds what the operator can do to a failed render's message.
 */
export interface BackendSource {
  /** Finds the backend; a discovery it runs is bounded by `budgetMs` when given. */
  readonly acquire: (budgetMs?: number) => Promise<Bun.WebView.Backend>
  readonly invalidate: () => void
  readonly explain?: (message: string) => string
}

type Viewport = { readonly width: number; readonly height: number; readonly scale: number }

type Sandbox = Parameters<Service['renderPdf']>[2]

/** An image's bytes, checked against the size limit, with its metadata. */
const checkedImage = (
  config: RendererConfig,
  format: RenderImageFormat | undefined,
  image: { readonly bytes: Uint8Array; readonly width: number; readonly height: number }
): Effect.Effect<RenderedImage, RenderLimitExceededError> =>
  limited(config, image.bytes.length).pipe(
    Effect.as({
      bytes: image.bytes,
      contentType: CONTENT_TYPES[format ?? 'png'],
      width: image.width,
      height: image.height,
      size: image.bytes.length,
    })
  )

interface WebviewEngine {
  readonly config: RendererConfig
  readonly backend: BackendSource
  readonly permits: Semaphore.Semaphore
  readonly onFirstView: () => void
}

/** One render on a fresh view, holding one concurrency permit. */
const renderOnView = <T>(
  engine: WebviewEngine,
  input: {
    readonly viewport: Viewport | undefined
    readonly html: string
    readonly sandbox: Sandbox
    readonly capture: (view: Bun.WebView) => Promise<T>
  }
): Effect.Effect<T, DocumentRenderError> =>
  Effect.tryPromise({
    try: async () => {
      const html = await stripRemoteReferences(
        input.html,
        input.sandbox?.allowRemoteAssets === true ? outboundGuardAccepts : undefined
      )
      const render = (backend: Bun.WebView.Backend, timeoutMs: number): Promise<T> =>
        runSandboxedRender({
          backend,
          html,
          sandbox: input.sandbox ?? {},
          timeoutMs,
          ...(input.viewport === undefined ? {} : { viewport: input.viewport }),
          capture: input.capture,
        })
      // ONE budget from here, inside this permit: finding the backend (the
      // first DevTools discovery included) and rendering on it share
      // `RENDERER_TIMEOUT_MS`, and a Chrome that died while starting is
      // launched once more with what is left (`renderer-launch-retry.ts`). The
      // retry forgets the endpoint first, so it re-discovers a restarted
      // sidecar rather than dialling the dead one.
      return renderWithinBudget(
        async (ms) => {
          const backend = await engine.backend.acquire(ms)
          engine.onFirstView()
          return backend
        },
        render,
        {
          timeoutMs: engine.config.timeoutMs,
          exceeded: () => new RenderDeadlineExceeded(engine.config.timeoutMs),
          beforeRetry: () => engine.backend.invalidate(),
        }
      )
    },
    catch: (error): DocumentRenderError => renderErrorOf(engine, error),
  }).pipe(engine.permits.withPermits(1))

/**
 * A failed render as the port's error. Any failure other than the deadline or
 * a limit may be a connection that no longer leads anywhere, so the memoised
 * address is forgotten and the next render discovers it again.
 */
const renderErrorOf = (engine: WebviewEngine, error: unknown): DocumentRenderError => {
  if (error instanceof RenderDeadlineExceeded) return timedOut(engine.config.timeoutMs)
  if (error instanceof RenderAreaExceeded) return overLimit(error.message)
  engine.backend.invalidate()
  if (error instanceof BackendUnreachable) {
    return unavailable(
      `the Chrome DevTools endpoint could not be reached (RENDERER_CDP_URL): ${describe(error.cause)}`
    )
  }
  const message = describe(error)
  return failed(engine.backend.explain?.(message) ?? message, error)
}

/** The `webview` service: `Bun.WebView` with the Chrome backend. */
export const webviewRenderer = (engine: WebviewEngine): Service =>
  DocumentRenderer.of({
    provider: 'webview',
    renderPdf: (html, setup, sandbox) =>
      renderOnView(engine, { viewport: undefined, html, sandbox, capture: capturePdf(setup) }).pipe(
        Effect.flatMap((bytes) => checkedPdf(engine.config, bytes)),
        Effect.withSpan('document-renderer.webview.pdf')
      ),
    renderImage: (html, options, sandbox) => {
      const viewport = {
        width: options.width,
        height: options.height ?? 800,
        scale: options.scale ?? 1,
      }
      return declaredAreaFits(viewport).pipe(
        Effect.flatMap(() =>
          renderOnView(engine, { viewport, html, sandbox, capture: captureImage(options) })
        ),
        Effect.flatMap((image) => checkedImage(engine.config, options.format, image)),
        Effect.withSpan('document-renderer.webview.image')
      )
    },
  })

const isAbort = (error: unknown): boolean =>
  error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')

type GotenbergConfig = RendererConfig & { readonly gotenbergUrl: string }

/** One Gotenberg conversion, holding one concurrency permit. */
const postToGotenberg = (
  config: GotenbergConfig,
  permits: Semaphore.Semaphore,
  form: {
    readonly route: string
    readonly files: readonly GotenbergFile[]
    readonly fields: Record<string, string>
  }
): Effect.Effect<Uint8Array, DocumentRenderError> =>
  Effect.tryPromise({
    try: () =>
      postGotenbergForm({
        baseUrl: config.gotenbergUrl,
        ...form,
        timeoutMs: config.timeoutMs,
        maxOutputBytes: config.maxOutputBytes,
      }),
    catch: (error): DocumentRenderError =>
      isAbort(error)
        ? timedOut(config.timeoutMs)
        : unavailable(
            `Gotenberg could not be reached at ${redactConnectionUrl(config.gotenbergUrl)} (RENDERER_URL): ${describe(error)}`
          ),
  }).pipe(
    Effect.flatMap((result) => {
      if (result.ok) return Effect.succeed(result.bytes)
      return Effect.fail(
        result.reason === 'too-large'
          ? overLimit(`${result.message} (RENDERER_MAX_OUTPUT_BYTES)`)
          : failed(result.message)
      )
    }),
    permits.withPermits(1)
  )

/** Gotenberg fetches on its own, so a remote asset could not pass the outbound guard. */
const refuseRemote = (sandbox: Sandbox): Effect.Effect<void, RenderFailedError> =>
  sandbox?.allowRemoteAssets === true
    ? Effect.fail(
        failed(
          'allowRemoteAssets needs RENDERER_PROVIDER=webview: Gotenberg fetches on its own, so remote assets cannot pass the outbound guard; inline them as data: URIs'
        )
      )
    : Effect.void

/** The document with its network references removed: Gotenberg serves no remote asset. */
const withoutRemote = (html: string): Effect.Effect<string, DocumentRenderError> =>
  Effect.tryPromise({
    try: () => stripRemoteReferences(html),
    catch: (error): DocumentRenderError => failed(describe(error), error),
  })

/** The `gotenberg` service: Gotenberg's Chromium routes. */
export const gotenbergRenderer = (config: GotenbergConfig, permits: Semaphore.Semaphore): Service =>
  DocumentRenderer.of({
    provider: 'gotenberg',
    renderPdf: (html, setup, sandbox) =>
      refuseRemote(sandbox).pipe(
        Effect.flatMap(() => withoutRemote(html)),
        Effect.flatMap((document) =>
          postToGotenberg(config, permits, {
            route: '/forms/chromium/convert/html',
            ...gotenbergPdfForm(document, setup),
          })
        ),
        Effect.flatMap((bytes) => checkedPdf(config, bytes)),
        Effect.withSpan('document-renderer.gotenberg.pdf')
      ),
    renderImage: (html, options, sandbox) =>
      refuseRemote(sandbox).pipe(
        Effect.flatMap(() =>
          declaredAreaFits({
            width: options.width,
            height: options.height ?? 0,
            scale: options.scale ?? 1,
          })
        ),
        Effect.flatMap(() => withoutRemote(html)),
        Effect.flatMap((document) => {
          const form = gotenbergImageForm(document, options)
          if (!form.ok) return Effect.fail(failed(form.reason))
          return postToGotenberg(config, permits, {
            route: '/forms/chromium/screenshot/html',
            files: form.files,
            fields: form.fields,
          }).pipe(
            Effect.flatMap((bytes) =>
              checkedImage(config, options.format, {
                bytes,
                width: options.width,
                height: form.height,
              })
            )
          )
        }),
        Effect.withSpan('document-renderer.gotenberg.image')
      ),
  })
