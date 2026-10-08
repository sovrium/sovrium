/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Document renderer port ([internal ref] D2): HTML → PDF and HTML → raster image
 * through a real browser the operator points Sovrium at (`RENDERER_*`).
 *
 * The port receives HTML that is ALREADY filled — templating, escaping and
 * asset inlining are the caller's. What the port guarantees is the sandbox
 * ([internal ref] D8): a fresh page per render, JavaScript off, and every request the
 * page makes either answered by the caller's {@link AssetResolver}, fetched
 * through the guarded egress when `allowRemoteAssets` is set, or failed. The
 * browser never opens a socket of its own and never reads a `file://` URL.
 *
 * Every error message STARTS with its code (`renderer_unavailable: …`) and
 * names the environment variable that changes the outcome, so a run error an
 * operator reads tells them which knob to turn.
 */

/** No renderer is configured or reachable. Names `RENDERER_PROVIDER` / `RENDERER_CHROME_PATH` / `RENDERER_CDP_URL`. */
export class RendererUnavailableError extends Data.TaggedError('RendererUnavailableError')<{
  readonly code: 'renderer_unavailable'
  readonly message: string
}> {}

/** The render outlasted `RENDERER_TIMEOUT_MS`; the page was closed. */
export class RenderTimeoutError extends Data.TaggedError('RenderTimeoutError')<{
  readonly code: 'render_timeout'
  readonly message: string
  readonly timeoutMs: number
}> {}

/** The output went past `RENDERER_MAX_PAGES` or `RENDERER_MAX_OUTPUT_BYTES`; nothing is returned. */
export class RenderLimitExceededError extends Data.TaggedError('RenderLimitExceededError')<{
  readonly code: 'render_limit_exceeded'
  readonly message: string
}> {}

/** The engine was reached but the render itself failed (bad selector, engine error, crash). */
export class RenderFailedError extends Data.TaggedError('RenderFailedError')<{
  readonly code: 'render_failed'
  readonly message: string
  readonly cause?: unknown
}> {}

/** Every failure the {@link DocumentRenderer} port can surface. */
export type DocumentRenderError =
  RendererUnavailableError | RenderTimeoutError | RenderLimitExceededError | RenderFailedError

/** The origin the page is served from. A relative URL in the HTML resolves against it. */
export const RENDER_DOCUMENT_ORIGIN = 'https://render.sovrium.invalid'

/**
 * Tokens a caller puts in a header or footer where the current page number and
 * the page count go. They are plain text, so they survive escaped templating
 * (`{{pageNumber}}` rendered with `pageNumber: PAGE_NUMBER_TOKEN`); the adapter
 * swaps them for the engine's own counters, filled on every page.
 */
export const PAGE_NUMBER_TOKEN = '__SOVRIUM_PAGE_NUMBER__'
export const TOTAL_PAGES_TOKEN = '__SOVRIUM_TOTAL_PAGES__'

/** A file the caller serves to the page. */
export interface RenderAsset {
  readonly bytes: Uint8Array
  readonly contentType: string
}

/**
 * Answers one request the page makes, by absolute URL (relative URLs arrive
 * resolved against {@link RENDER_DOCUMENT_ORIGIN}). `undefined` = not mine:
 * the request is fetched remotely when `allowRemoteAssets` is set, else failed.
 * Only the `webview` adapter consults it; inline assets as `data:` URIs to be
 * engine-independent.
 */
export type AssetResolver = (url: string) => Promise<RenderAsset | undefined>

/** How the page may load what it references. */
export interface RenderSandboxOptions {
  readonly assetResolver?: AssetResolver
  /** Fetch an unresolved http(s) URL through the guarded egress. Default `false`. */
  readonly allowRemoteAssets?: boolean
}

export type PaperFormat = 'A3' | 'A4' | 'A5' | 'Letter' | 'Legal'

/** Page setup of a PDF. Lengths are CSS lengths with a unit (`20mm`, `0.5in`, `12pt`, `96px`, `2cm`). */
export interface PdfPageSetup {
  /** @default 'A4' */
  readonly pageSize?: PaperFormat
  /** @default 'portrait' */
  readonly orientation?: 'portrait' | 'landscape'
  /** An omitted side keeps the engine default (about 1 cm). */
  readonly margins?: {
    readonly top?: string
    readonly right?: string
    readonly bottom?: string
    readonly left?: string
  }
  /** HTML printed at the top of every page; may carry the page tokens. Escaped by the caller. */
  readonly headerHtml?: string
  /** HTML printed at the bottom of every page; may carry the page tokens. Escaped by the caller. */
  readonly footerHtml?: string
  /** Print CSS backgrounds. @default true */
  readonly printBackground?: boolean
}

export type RenderImageFormat = 'png' | 'jpeg' | 'webp'

/** Screenshot setup of an image render. */
export interface ImageRenderOptions {
  /** Viewport width in CSS pixels. */
  readonly width: number
  /** Viewport height in CSS pixels; omitted = the full height of the content. */
  readonly height?: number
  /** Device pixel ratio: the output is `width × scale` pixels wide. @default 1 */
  readonly scale?: number
  /** @default 'png' */
  readonly format?: RenderImageFormat
  /** JPEG / WebP quality, 0–100. Ignored for PNG. */
  readonly quality?: number
  /** Capture only the first element matching this CSS selector. */
  readonly selector?: string
  /** A transparent page background instead of white (PNG / WebP). */
  readonly transparent?: boolean
}

export interface RenderedPdf {
  readonly bytes: Uint8Array
  readonly contentType: 'application/pdf'
  /** Counted in the produced PDF, not estimated. */
  readonly pages: number
  readonly size: number
}

export interface RenderedImage {
  readonly bytes: Uint8Array
  readonly contentType: 'image/png' | 'image/jpeg' | 'image/webp'
  /** Output dimensions in pixels. */
  readonly width: number
  readonly height: number
  readonly size: number
}

export class DocumentRenderer extends Context.Service<
  DocumentRenderer,
  {
    /** Which adapter answers, for diagnostics; `off` when HTML rendering is unavailable. */
    readonly provider: 'webview' | 'gotenberg' | 'off'
    readonly renderPdf: (
      html: string,
      pageSetup: PdfPageSetup,
      sandbox?: RenderSandboxOptions
    ) => Effect.Effect<RenderedPdf, DocumentRenderError>
    readonly renderImage: (
      html: string,
      options: ImageRenderOptions,
      sandbox?: RenderSandboxOptions
    ) => Effect.Effect<RenderedImage, DocumentRenderError>
  }
>()('DocumentRenderer') {}
