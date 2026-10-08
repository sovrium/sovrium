/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { stripCssReferences } from './gotenberg-css-references'
import { bandTemplate, imageAreaRefusal, toPrintToPdfParams } from './renderer-page-setup'
import type { GotenbergFile } from './gotenberg-client'
import type {
  ImageRenderOptions,
  PdfPageSetup,
} from '@/application/ports/services/document-renderer'

/**
 * The `RENDERER_PROVIDER=gotenberg` translation: a page setup or a screenshot
 * request as the form Gotenberg's Chromium routes take (full
 * `gotenberg/gotenberg:8` image; the `-libreoffice` variant has no Chromium).
 *
 * ## The sandbox here is the document's own
 *
 * Sovrium cannot intercept Gotenberg's requests, so the `AssetResolver` is not
 * consulted and `allowRemoteAssets` is refused by the caller. What stands
 * instead is the HTML Gotenberg receives, made inert before it is sent:
 *
 * - every `<script>`, `<iframe>`, `<object>`, `<embed>`, `<frame>` and
 *   `<base>` is removed, and every `<noscript>` with what it holds (with
 *   scripts off, Chromium parses its content as markup);
 * - every `<meta http-equiv>` is removed — a `refresh` navigates, and a
 *   Content-Security-Policy does not govern navigation;
 * - every `<link>` whose `href` is not a `data:` URL is removed;
 * - every CSS `@import`, and every `url()` that is not a `data:` URL, is
 *   removed from `<style>` text and `style` attributes;
 * - the policy below is written BEFORE the template's first byte (after a
 *   doctype of ours when the template had one, so its rendering mode holds),
 *   so nothing the template says is parsed before Chromium knows the rule.
 *
 * Inline assets as `data:` URIs to render them. The compose recipe runs the
 * sidecar with JavaScript disabled and no outbound route, as defence in depth.
 */

/** The CSP a Gotenberg-rendered document carries: no script, no network. */
export const GOTENBERG_DOCUMENT_CSP =
  "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline' data:; font-src data:; script-src 'none'"

const CSP_META = `<meta http-equiv="Content-Security-Policy" content="${GOTENBERG_DOCUMENT_CSP}">`

const REMOVED_ELEMENTS =
  'script, noscript, iframe, object, embed, frame, frameset, base, meta[http-equiv]'

const isInlineHref = (href: string | null): boolean => href !== null && /^\s*data:/i.test(href)

/** The template with every active element and every loading reference removed. */
const inertDocument = (html: string): string => {
  const css = { text: '' }
  return new HTMLRewriter()
    .on(REMOVED_ELEMENTS, {
      element: (element) => {
        element.remove()
      },
    })
    .on('link', {
      element: (element) => {
        if (!isInlineHref(element.getAttribute('href')) || element.hasAttribute('imagesrcset')) {
          element.remove()
        }
      },
    })
    .on('[style]', {
      element: (element) => {
        element.setAttribute('style', stripCssReferences(element.getAttribute('style') ?? ''))
      },
    })
    .on('style', {
      text: (chunk) => {
        css.text += chunk.text
        if (!chunk.lastInTextNode) {
          chunk.remove()
          return
        }
        chunk.replace(stripCssReferences(css.text), { html: true })
        css.text = ''
      },
    })
    .transform(html)
}

/**
 * The HTML made inert (see the module header), its policy first: after a
 * doctype of ours when the template opened with one, else as the very first
 * bytes. The parser moves the policy into the implied head either way.
 */
export const sandboxForGotenberg = (html: string): string => {
  const inert = inertDocument(html)
  const doctype = /^\s*<!doctype[^>]*>/i.exec(inert)
  return doctype === null
    ? `${CSP_META}${inert}`
    : `<!doctype html>${CSP_META}${inert.slice(doctype[0].length)}`
}

/** Inches as Gotenberg reads them, rounded off the float noise of the unit conversion. */
const inches = (value: number): string => `${String(Number(value.toFixed(4)))}in`

const htmlFile = (name: string, html: string): GotenbergFile => ({
  name,
  bytes: new TextEncoder().encode(html),
  contentType: 'text/html',
})

const bandDocument = (html: string | undefined, setup: PdfPageSetup): string =>
  sandboxForGotenberg(
    `<!doctype html><html><head></head><body>${bandTemplate(html, setup)}</body></html>`
  )

/** Files and fields of `POST /forms/chromium/convert/html`. */
export const gotenbergPdfForm = (
  html: string,
  setup: PdfPageSetup
): { readonly files: readonly GotenbergFile[]; readonly fields: Record<string, string> } => {
  const params = toPrintToPdfParams(setup)
  const margins = Object.fromEntries(
    (['marginTop', 'marginRight', 'marginBottom', 'marginLeft'] as const).flatMap((key) =>
      params[key] === undefined ? [] : [[key, inches(params[key])]]
    )
  )
  const bands = params.displayHeaderFooter
    ? [
        htmlFile('header.html', bandDocument(setup.headerHtml, setup)),
        htmlFile('footer.html', bandDocument(setup.footerHtml, setup)),
      ]
    : []
  return {
    files: [htmlFile('index.html', sandboxForGotenberg(html)), ...bands],
    fields: {
      paperWidth: inches(params.paperWidth),
      paperHeight: inches(params.paperHeight),
      landscape: String(params.landscape),
      printBackground: String(params.printBackground),
      preferCssPageSize: 'false',
      ...margins,
    },
  }
}

/**
 * Files and fields of `POST /forms/chromium/screenshot/html`, or why the
 * request needs the `webview` renderer: Gotenberg takes no device scale, no
 * element selector, and needs an explicit height.
 */
export const gotenbergImageForm = (
  html: string,
  options: ImageRenderOptions
):
  | {
      readonly ok: true
      readonly files: readonly GotenbergFile[]
      readonly fields: Record<string, string>
      readonly height: number
    }
  | { readonly ok: false; readonly reason: string } => {
  if (options.selector !== undefined) {
    return { ok: false, reason: 'an element selector needs RENDERER_PROVIDER=webview' }
  }
  if ((options.scale ?? 1) !== 1) {
    return { ok: false, reason: 'a scale other than 1 needs RENDERER_PROVIDER=webview' }
  }
  if (options.height === undefined) {
    return { ok: false, reason: 'a full-page image (no height) needs RENDERER_PROVIDER=webview' }
  }
  // The clip is the image: never ask for one past the side or area limit.
  const tooLarge = imageAreaRefusal({ width: options.width, height: options.height, scale: 1 })
  if (tooLarge !== undefined) return { ok: false, reason: tooLarge }
  const format = options.format ?? 'png'
  return {
    ok: true,
    height: options.height,
    files: [htmlFile('index.html', sandboxForGotenberg(html))],
    fields: {
      width: String(options.width),
      height: String(options.height),
      clip: 'true',
      format,
      omitBackground: String(options.transparent === true),
      ...(format !== 'png' && options.quality !== undefined
        ? { quality: String(options.quality) }
        : {}),
    },
  }
}
