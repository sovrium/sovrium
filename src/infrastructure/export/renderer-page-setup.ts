/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  PAGE_NUMBER_TOKEN,
  TOTAL_PAGES_TOKEN,
  type PaperFormat,
  type PdfPageSetup,
} from '@/application/ports/services/document-renderer'

/**
 * Pure translation of a {@link PdfPageSetup} into what a Chrome print takes —
 * CDP `Page.printToPDF` parameters, or Gotenberg's form fields, which mirror
 * them — plus the page count read back from the produced PDF.
 */

/** Paper sizes in millimetres, portrait. */
const PAPER_MM: Readonly<Record<PaperFormat, readonly [number, number]>> = {
  A3: [297, 420],
  A4: [210, 297],
  A5: [148, 210],
  Letter: [215.9, 279.4],
  Legal: [215.9, 355.6],
}

const INCHES_PER_UNIT: Readonly<Record<string, number>> = {
  mm: 1 / 25.4,
  cm: 1 / 2.54,
  in: 1,
  pt: 1 / 72,
  px: 1 / 96,
}

/** A CSS length with a print unit, in inches; `undefined` for anything else. */
export const lengthToInches = (length: string): number | undefined => {
  const match = /^(\d+\.?\d*|\.\d+)(mm|cm|in|pt|px)$/.exec(length.trim())
  if (match === null) return undefined
  const [, value, unit] = match
  const factor = INCHES_PER_UNIT[unit ?? '']
  return factor === undefined ? undefined : Number(value) * factor
}

/**
 * The base CSS of a header or footer band. Chrome renders the band in its own
 * document across the full page width, with a default font size too small to
 * read: a readable size is set, and the band is inset by the page's own left
 * and right margins (0.4in where a side declares none), so its text lines up
 * with the content. The caller's own inline styles still win.
 */
const bandStyle = (inset: { readonly left: string; readonly right: string }): string =>
  `<style>html,body{margin:0;padding:0 ${inset.right} 0 ${inset.left};font-size:10px;width:100%;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style>`

const DEFAULT_BAND_INSET = '0.4in'

/** The horizontal inset of the bands: the page's left and right margins as written. */
const bandInset = (
  setup: PdfPageSetup | undefined
): { readonly left: string; readonly right: string } => {
  const side = (name: 'left' | 'right'): string => {
    const raw = setup?.margins?.[name]
    return raw !== undefined && lengthToInches(raw) !== undefined ? raw.trim() : DEFAULT_BAND_INSET
  }
  return { left: side('left'), right: side('right') }
}

/**
 * Swap the page tokens for Chrome's own counters, which Chrome fills on every
 * page: an element with class `pageNumber` / `totalPages`.
 */
export const withPageCounters = (html: string): string =>
  html
    .replaceAll(PAGE_NUMBER_TOKEN, '<span class="pageNumber"></span>')
    .replaceAll(TOTAL_PAGES_TOKEN, '<span class="totalPages"></span>')

/**
 * The HTML without its `<noscript>` elements. A rewriter that runs with
 * scripting on reads their content as raw text, so nothing inside one is ever
 * cleaned — but a browser rendering with scripts OFF parses that content as
 * markup, and a `<meta http-equiv="refresh">` or a `<link>` in it would then
 * act. Removing the element (with what it holds) is the only safe reading.
 */
export const withoutNoscript = (html: string): string =>
  new HTMLRewriter()
    .on('noscript', {
      element: (element) => {
        element.remove()
      },
    })
    .transform(html)

/** A header or footer as Chrome prints it: counters in place, the band style first. */
export const bandTemplate = (html: string | undefined, setup?: PdfPageSetup): string =>
  html === undefined
    ? '<span></span>'
    : `${bandStyle(bandInset(setup))}${withPageCounters(withoutNoscript(html))}`

/** CDP `Page.printToPDF` parameters for a page setup. */
export type PrintToPdfParams = {
  readonly paperWidth: number
  readonly paperHeight: number
  readonly landscape: boolean
  readonly printBackground: boolean
  readonly preferCSSPageSize: false
  readonly displayHeaderFooter: boolean
  readonly headerTemplate?: string
  readonly footerTemplate?: string
  readonly marginTop?: number
  readonly marginRight?: number
  readonly marginBottom?: number
  readonly marginLeft?: number
}

const MARGIN_KEYS = [
  ['top', 'marginTop'],
  ['right', 'marginRight'],
  ['bottom', 'marginBottom'],
  ['left', 'marginLeft'],
] as const

/** The margins of a page setup in inches, keyed the CDP way; an unreadable or omitted side is left out. */
export const marginsInInches = (
  setup: PdfPageSetup
): Partial<Record<(typeof MARGIN_KEYS)[number][1], number>> =>
  Object.fromEntries(
    MARGIN_KEYS.flatMap(([side, key]) => {
      const raw = setup.margins?.[side]
      const inches = raw === undefined ? undefined : lengthToInches(raw)
      return inches === undefined ? [] : [[key, inches] as const]
    })
  )

/**
 * Translate a page setup into `Page.printToPDF` parameters. The paper is given
 * in its portrait dimensions and `landscape` turns it, as Chrome expects. A
 * header or footer turns `displayHeaderFooter` on, and the missing one of the
 * two is an empty band — Chrome would print its own date and title otherwise.
 */
export const toPrintToPdfParams = (setup: PdfPageSetup): PrintToPdfParams => {
  const [widthMm, heightMm] = PAPER_MM[setup.pageSize ?? 'A4']
  const bands = setup.headerHtml !== undefined || setup.footerHtml !== undefined
  return {
    paperWidth: widthMm / 25.4,
    paperHeight: heightMm / 25.4,
    landscape: setup.orientation === 'landscape',
    printBackground: setup.printBackground ?? true,
    preferCSSPageSize: false,
    displayHeaderFooter: bands,
    ...(bands
      ? {
          headerTemplate: bandTemplate(setup.headerHtml, setup),
          footerTemplate: bandTemplate(setup.footerHtml, setup),
        }
      : {}),
    ...marginsInInches(setup),
  }
}

/**
 * The number of pages in a PDF, read from its bytes: the count of page objects
 * (`/Type /Page`, never `/Pages`), else the largest `/Count` of a page tree.
 * Chrome writes uncompressed object headers, so the scan is exact for its
 * output; `0` means "not a PDF this can read", which the caller treats as a
 * failed render rather than a one-page document.
 */
export const countPdfPages = (bytes: Uint8Array): number => {
  const text = new TextDecoder('latin1').decode(bytes)
  const pages = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0
  if (pages > 0) return pages
  const counts = [...text.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]))
  return counts.length === 0 ? 0 : Math.max(...counts)
}

/**
 * The page count {@link countPdfPages} reads, and when the scan finds nothing,
 * the count of a full parse. A PDF written with object streams (Gotenberg's
 * post-processing, a future Chrome) compresses its page objects, so the byte
 * scan sees none; the parser reads them. `0` still means "not a PDF".
 */
export const readPdfPageCount = async (bytes: Uint8Array): Promise<number> => {
  const scanned = countPdfPages(bytes)
  if (scanned > 0) return scanned
  try {
    const { PDFDocument } = await import('@cantoo/pdf-lib')
    const document = await PDFDocument.load(bytes, {
      updateMetadata: false,
      ignoreEncryption: true,
    })
    return document.getPageCount()
  } catch {
    // Unparseable, or no page tree: not a PDF this can count, which is what 0 says.
    return 0
  }
}

/** The widest or tallest image the browser can capture, in device pixels (Chrome's texture limit). */
export const MAX_IMAGE_SIDE_PX = 16_384

/** The most device pixels one image may hold: ~160 MB decoded, before encoding. */
export const MAX_IMAGE_PIXELS = 40_000_000

/**
 * Why an image of `width` × `height` CSS pixels at `scale` is refused, or
 * `undefined` when it fits. Checked before the view opens, on the declared
 * size, and again before the capture, on the measured page: a full-page
 * screenshot of a page whose content is unbounded would otherwise allocate
 * whatever the content asks for.
 */
export const imageAreaRefusal = (area: {
  readonly width: number
  readonly height: number
  readonly scale: number
}): string | undefined => {
  const width = Math.ceil(area.width * area.scale)
  const height = Math.ceil(area.height * area.scale)
  if (width > MAX_IMAGE_SIDE_PX || height > MAX_IMAGE_SIDE_PX) {
    return `the image is ${String(width)} × ${String(height)} pixels, above the ${String(MAX_IMAGE_SIDE_PX)}-pixel side limit`
  }
  if (width * height > MAX_IMAGE_PIXELS) {
    return `the image is ${String(width)} × ${String(height)} pixels, above the ${String(MAX_IMAGE_PIXELS)}-pixel area limit`
  }
  return undefined
}
